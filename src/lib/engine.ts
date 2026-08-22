// Движок комплекса: rAF-цикл отрисовки, периодический прогон конвейера анализа,
// журнал классификаций с перемоткой, журнал событий, видео-сравнение с эталоном,
// управление камерами/сценариями, загрузка пользовательских кадров.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AW,
  AH,
  buildHeat,
  classifyBlob,
  estimateTempC,
  extractBlobs,
} from './pipeline';
import { CAMERAS, drawCover, detectWaterSources, loadCameraSource, type WaterSource } from './scenes';
import { SCENARIOS, drawScenario } from './scenarios';
import { composeDashboard } from './screenshot';
import type {
  Artifact,
  Detection,
  EngineStats,
  JournalEntry,
  LogEvent,
  OverlaySettings,
  RulerState,
  ScenarioId,
  Severity,
  Snapshot,
  SystemStatus,
  ToastMsg,
  VideoState,
  ViewMode,
} from './types';
import { KLASS_META } from './types';

export const VIEW_W = 896;
export const VIEW_H = 504;
const ANALYZE_EVERY_MS = 200;
const PX_TO_M = 0.42; // условный масштаб: метры на пиксель кадра
const MAX_HISTORY = 900; // ~3 минуты при 5 Гц
const MAX_JOURNAL = 160;

let eventSeq = 1;
let detSeq = 1;
let journalSeq = 1;
let toastSeq = 1;
let diffBuf: Uint8Array | null = null;

function makeNoiseCanvas(w: number, h: number, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  let a = seed >>> 0;
  for (let i = 0; i < img.data.length; i += 4) {
    a = (a * 1664525 + 1013904223) >>> 0;
    const v = a >>> 24;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export interface Engine {
  ready: boolean;
  cameraId: string;
  setCamera: (id: string) => void;
  scenario: ScenarioId;
  setScenario: (s: ScenarioId) => void;
  threshold: number;
  setThreshold: (v: number) => void;
  minArea: number;
  setMinArea: (v: number) => void;
  overlays: OverlaySettings;
  toggleOverlay: (key: keyof OverlaySettings) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  comparePos: number;
  setComparePos: (v: number) => void;
  detections: Detection[];
  status: SystemStatus;
  events: LogEvent[];
  stats: EngineStats;
  customRef: boolean;
  customCur: boolean;
  uploadReference: (file: File) => void;
  uploadCurrent: (file: File) => void;
  resetCustom: () => void;
  snapshot: () => void;
  exportReport: () => void;
  // журнал классификаций с перемоткой
  following: boolean;
  scrubIndex: number;
  historyLen: number;
  journal: JournalEntry[];
  display: Snapshot | null;
  seek: (logicalIdx: number) => void;
  followLive: () => void;
  // видео
  video: VideoState;
  uploadVideo: (file: File) => void;
  toggleVideoPlay: () => void;
  seekVideo: (t: number) => void;
  stopVideo: () => void;
  waterSourceCount: number;
  // скорость развития сценариев / видео
  speed: number;
  setSpeed: (v: number) => void;
  // файлы и уведомления
  artifact: Artifact | null;
  clearArtifact: () => void;
  toasts: ToastMsg[];
  // масштаб карты и инструмент «Линейка»
  mapScale: number;
  setMapScale: (v: number) => void;
  rulerActive: boolean;
  ruler: RulerState;
  toggleRuler: () => void;
  resetRuler: () => void;
  rulerClick: (x: number, y: number) => void;
  setCursor: (x: number | null, y: number | null) => void;
  bindLive: (el: HTMLCanvasElement | null) => void;
  bindRef: (el: HTMLCanvasElement | null) => void;
  bindHeat: (el: HTMLCanvasElement | null) => void;
  bindOverlay: (el: HTMLCanvasElement | null) => void;
}

export function useEngine(): Engine {
  const [ready, setReady] = useState(false);
  const [cameraId, setCameraId] = useState('cam1');
  const [scenario, setScenarioState] = useState<ScenarioId>('calm');
  const [threshold, setThreshold] = useState(26);
  const [minArea, setMinArea] = useState(26);
  const [overlays, setOverlays] = useState<OverlaySettings>({
    boxes: true,
    heat: true,
    grid: false,
    thermal: true,
  });
  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [comparePos, setComparePos] = useState(50);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [stats, setStats] = useState<EngineStats>({ lastMs: 0, segments: 0, fps: 0, peakTemp: 21, tick: 0 });
  const [customRef, setCustomRef] = useState(false);
  const [customCur, setCustomCur] = useState(false);
  // журнал + перемотка
  const [historyLen, setHistoryLen] = useState(0);
  const [following, setFollowingState] = useState(true);
  const [scrubIndex, setScrubIndex] = useState(-1);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [display, setDisplay] = useState<Snapshot | null>(null);
  // видео
  const [video, setVideo] = useState<VideoState>({
    active: false,
    playing: false,
    name: '',
    duration: 0,
    currentTime: 0,
  });
  const [waterSourceCount, setWaterSourceCount] = useState(0);
  // множитель скорости развития сценариев / видео
  const [speed, setSpeedState] = useState(1);
  // файлы для скачивания + уведомления
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  // масштаб карты (м на пиксель вьюпорта) и инструмент «Линейка»
  const [mapScale, setMapScaleState] = useState(1.6);
  const [rulerActive, setRulerActive] = useState(false);
  const [ruler, setRuler] = useState<RulerState>({ phase: 'idle', ax: 0, ay: 0, bx: 0, by: 0 });

  const liveRef = useRef<HTMLCanvasElement | null>(null);
  const refRef = useRef<HTMLCanvasElement | null>(null);
  const heatRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const camSources = useRef<Record<string, CanvasImageSource | null>>({});
  const refData = useRef<ImageData | null>(null);
  const uploadedRefImg = useRef<HTMLImageElement | null>(null);
  const uploadedCurImg = useRef<HTMLImageElement | null>(null);
  const scenarioStart = useRef(performance.now());
  const activeClasses = useRef<Set<string>>(new Set());
  const thermalLogged = useRef(false);
  const prevDets = useRef<Detection[]>([]);
  const eventsRef = useRef<LogEvent[]>([]);

  // журнал / перемотка (внутри цикла)
  const historyRef = useRef<Snapshot[]>([]);
  const histBaseRef = useRef(0);
  const journalRef = useRef<JournalEntry[]>([]);
  const followingRef = useRef(true);
  const sessionStart = useRef(performance.now());
  const lastSigRef = useRef('');
  const lastEntryTickRef = useRef(-100);
  const displayRef = useRef<Detection[]>([]);
  const statsRef = useRef<EngineStats>({ lastMs: 0, segments: 0, fps: 0, peakTemp: 21, tick: 0 });
  // видео (внутри цикла)
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const videoActiveRef = useRef(false);
  const videoPlayingRef = useRef(false);
  // скорость симуляции: накопленное время + текущий множитель
  const simAccum = useRef(0);
  const speedRef = useRef(1);
  // линейка (внутри цикла отрисовки)
  const rulerActiveRef = useRef(false);
  const rulerRef = useRef<RulerState>({ phase: 'idle', ax: 0, ay: 0, bx: 0, by: 0 });
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const mapScaleRef = useRef(1.6);
  rulerRef.current = ruler;
  mapScaleRef.current = mapScale;
  // водоисточники
  const waterSourcesRef = useRef<WaterSource[]>([]);

  const bindLive = useCallback((el: HTMLCanvasElement | null) => {
    liveRef.current = el;
  }, []);
  const bindRef = useCallback((el: HTMLCanvasElement | null) => {
    refRef.current = el;
  }, []);
  const bindHeat = useCallback((el: HTMLCanvasElement | null) => {
    heatRef.current = el;
  }, []);
  const bindOverlay = useCallback((el: HTMLCanvasElement | null) => {
    overlayRef.current = el;
  }, []);

  eventsRef.current = events;
  displayRef.current = display ? display.dets : detections;

  const cfg = useRef({ cameraId, scenario, threshold, minArea, overlays, viewMode, ready, speed });
  cfg.current = { cameraId, scenario, threshold, minArea, overlays, viewMode, ready, speed };

  const pushEvent = useCallback((severity: Severity, text: string) => {
    const ev: LogEvent = {
      id: eventSeq++,
      time: new Date().toTimeString().slice(0, 8),
      severity,
      text,
    };
    setEvents((prev) => [ev, ...prev].slice(0, 80));
  }, []);

  /* ---------- уведомления и доставка файлов ---------- */
  const pushToast = useCallback((kind: 'ok' | 'err', text: string) => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);

  /**
   * Передаёт файл пользователю: пробует прямое скачивание и всегда открывает
   * окно предпросмотра (работает даже в средах, блокирующих download).
   */
  const deliver = useCallback(
    (blob: Blob, name: string, kind: 'png' | 'json', text?: string) => {
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        /* скачивание может быть заблокировано средой — файл доступен в предпросмотре */
      }
      setArtifact((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { kind, name, url, text };
      });
      pushToast('ok', `${name} готов · окно предпросмотра открыто`);
    },
    [pushToast],
  );

  const clearArtifact = useCallback(() => {
    setArtifact((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  /* ---------- возврат к «живому» просмотру ---------- */
  const resetPlayback = useCallback(() => {
    followingRef.current = true;
    setFollowingState(true);
    setScrubIndex(-1);
    setDisplay(null);
  }, []);

  const recomputeRef = useCallback(() => {
    const ac = document.createElement('canvas');
    ac.width = AW;
    ac.height = AH;
    const actx = ac.getContext('2d', { willReadFrequently: true })!;
    const src = uploadedRefImg.current ?? camSources.current[cfg.current.cameraId];
    if (!src) return;
    drawCover(actx, src, AW, AH);
    try {
      refData.current = actx.getImageData(0, 0, AW, AH);
    } catch {
      refData.current = null;
    }
    if (refData.current) {
      const srcs = detectWaterSources(refData.current);
      waterSourcesRef.current = srcs;
      setWaterSourceCount(srcs.length);
    }
  }, []);

  /* ---------- инициализация: загрузка камер ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await Promise.all(CAMERAS.map((c, i) => loadCameraSource(c.src, i)));
      if (cancelled) return;
      CAMERAS.forEach((c, i) => {
        camSources.current[c.id] = loaded[i];
      });
      recomputeRef();
      setReady(true);
      pushEvent('info', 'Конвейер анализа активен · эталон связан с ' + CAMERAS[0].short);
      pushEvent('info', 'Система инициализирована, камер в сети: ' + CAMERAS.length);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- управление ---------- */
  const setCamera = useCallback(
    (id: string) => {
      if (id === cfg.current.cameraId) return;
      setCameraId(id);
      cfg.current.cameraId = id;
      scenarioStart.current = performance.now();
      simAccum.current = 0;
      activeClasses.current.clear();
      thermalLogged.current = false;
      prevDets.current = [];
      setDetections([]);
      resetPlayback();
      setRuler({ phase: 'idle', ax: 0, ay: 0, bx: 0, by: 0 });
      if (!uploadedRefImg.current) recomputeRef();
      const cam = CAMERAS.find((c) => c.id === id);
      pushEvent('info', `Переключение на ${cam ? cam.name : id}`);
    },
    [pushEvent, recomputeRef, resetPlayback],
  );

  const setScenario = useCallback(
    (s: ScenarioId) => {
      if (s === cfg.current.scenario) return;
      setScenarioState(s);
      cfg.current.scenario = s;
      scenarioStart.current = performance.now();
      simAccum.current = 0;
      activeClasses.current.clear();
      thermalLogged.current = false;
      prevDets.current = [];
      setDetections([]);
      resetPlayback();
      if (s === 'calm') {
        pushEvent('info', 'Возврат к штатному режиму наблюдения');
      } else {
        const titles: Record<string, string> = {
          fire: '«Возгорание»',
          flood: '«Затопление»',
          collapse: '«Обрушение конструкций»',
          terrain: '«Изменение ландшафта»',
        };
        pushEvent('info', `Тестовый сценарий ${titles[s]} активирован`);
      }
    },
    [pushEvent, resetPlayback],
  );

  const toggleOverlay = useCallback((key: keyof OverlaySettings) => {
    setOverlays((o) => ({ ...o, [key]: !o[key] }));
  }, []);

  /* ---------- загрузка пользовательских кадров ---------- */
  const loadFile = useCallback((file: File, onReady: (img: HTMLImageElement) => void) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      onReady(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      pushEvent('warn', `Не удалось прочитать файл: ${file.name}`);
    };
    img.src = url;
  }, [pushEvent]);

  const uploadReference = useCallback(
    (file: File) => {
      loadFile(file, (img) => {
        uploadedRefImg.current = img;
        setCustomRef(true);
        activeClasses.current.clear();
        thermalLogged.current = false;
        recomputeRef();
        resetPlayback();
        pushEvent('info', `Эталонный кадр загружен: ${file.name}`);
      });
    },
    [loadFile, pushEvent, recomputeRef, resetPlayback],
  );

  const uploadCurrent = useCallback(
    (file: File) => {
      loadFile(file, (img) => {
        uploadedCurImg.current = img;
        setCustomCur(true);
        activeClasses.current.clear();
        thermalLogged.current = false;
        resetPlayback();
        pushEvent('info', `Анализируемый кадр загружен: ${file.name}`);
      });
    },
    [loadFile, pushEvent, resetPlayback],
  );

  /* ---------- видео: загрузка и управление ---------- */
  const stopVideoInternal = useCallback(() => {
    const v = videoElRef.current;
    if (v) v.pause();
    videoActiveRef.current = false;
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    videoElRef.current = null;
    setVideo({ active: false, playing: false, name: '', duration: 0, currentTime: 0 });
  }, []);

  const uploadVideo = useCallback(
    (file: File) => {
      stopVideoInternal();
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.src = url;
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.onloadedmetadata = () => {
        setVideo((s) => ({ ...s, duration: v.duration || 0 }));
        const sp = speedRef.current;
        if (sp <= 16) {
          v.playbackRate = sp;
          v.play().catch(() => {});
        } else {
          // слишком быстро для playbackRate — листаем кадры вручную в цикле
          v.pause();
        }
      };
      v.onplay = () => setVideo((s) => ({ ...s, playing: true }));
      v.onpause = () => {
        // в ручном режиме (×>16) видео всегда на паузе — статус держим сами
        if (speedRef.current <= 16) setVideo((s) => ({ ...s, playing: false }));
      };
      videoElRef.current = v;
      videoUrlRef.current = url;
      videoActiveRef.current = true;
      // видео становится текущим источником → сценарии и шум отключаются
      setScenarioState('calm');
      cfg.current.scenario = 'calm';
      uploadedCurImg.current = null;
      setCustomCur(false);
      activeClasses.current.clear();
      thermalLogged.current = false;
      prevDets.current = [];
      setDetections([]);
      resetPlayback();
      videoPlayingRef.current = true;
      setVideo({ active: true, playing: true, name: file.name, duration: 0, currentTime: 0 });
      pushEvent('info', `Видео загружено: ${file.name} · сравнение с эталоном в реальном времени`);
    },
    [pushEvent, resetPlayback, stopVideoInternal],
  );

  const toggleVideoPlay = useCallback(() => {
    const v = videoElRef.current;
    if (!v) return;
    const next = !videoPlayingRef.current;
    videoPlayingRef.current = next;
    if (speedRef.current <= 16) {
      if (next) v.play().catch(() => {});
      else v.pause();
    } else {
      // ручной режим: видео остаётся на паузе, кадры листаются в цикле
      setVideo((s) => ({ ...s, playing: next }));
    }
  }, []);

  const seekVideo = useCallback((t: number) => {
    const v = videoElRef.current;
    if (!v) return;
    v.currentTime = t;
    setVideo((s) => ({ ...s, currentTime: t }));
  }, []);

  const stopVideo = useCallback(() => {
    stopVideoInternal();
    resetPlayback();
    pushEvent('info', 'Видео остановлено · возврат к камере');
  }, [pushEvent, resetPlayback, stopVideoInternal]);

  /* ---------- множитель скорости развития сценариев / видео ---------- */
  const setSpeed = useCallback(
    (v: number) => {
      // фиксируем накопленное симуляционное время, чтобы не было скачка
      simAccum.current += ((performance.now() - scenarioStart.current) / 1000) * speedRef.current;
      scenarioStart.current = performance.now();
      speedRef.current = v;
      setSpeedState(v);
      cfg.current.speed = v;
      // видео: playbackRate поддерживается браузером до 16×, выше — покадровая перемотка
      const el = videoElRef.current;
      if (videoActiveRef.current && el) {
        if (v <= 16) {
          el.playbackRate = v;
          if (videoPlayingRef.current) el.play().catch(() => {});
        } else {
          el.pause(); // кадры будем листать вручную в цикле отрисовки
        }
      }
      pushEvent('info', `Скорость развития сценария: ×${v}`);
    },
    [pushEvent],
  );

  /* ---------- масштаб карты и инструмент «Линейка» ---------- */
  const IDLE_RULER: RulerState = { phase: 'idle', ax: 0, ay: 0, bx: 0, by: 0 };

  const setMapScale = useCallback((v: number) => {
    const clamped = Math.min(25, Math.max(0.1, Number.isFinite(v) ? v : 1.6));
    mapScaleRef.current = clamped;
    setMapScaleState(clamped);
  }, []);

  const resetRuler = useCallback(() => {
    setRuler(IDLE_RULER);
    cursorRef.current = null;
  }, []);

  const toggleRuler = useCallback(() => {
    const next = !rulerActiveRef.current;
    rulerActiveRef.current = next;
    setRulerActive(next);
    if (!next) setRuler(IDLE_RULER);
  }, []);

  const rulerClick = useCallback((x: number, y: number) => {
    setRuler((prev) =>
      prev.phase === 'live'
        ? { phase: 'done', ax: prev.ax, ay: prev.ay, bx: x, by: y }
        : { phase: 'live', ax: x, ay: y, bx: x, by: y },
    );
  }, []);

  const setCursor = useCallback((x: number | null, y: number | null) => {
    cursorRef.current = x == null || y == null ? null : { x, y };
  }, []);

  const resetCustom = useCallback(() => {
    stopVideoInternal();
    uploadedRefImg.current = null;
    uploadedCurImg.current = null;
    setCustomRef(false);
    setCustomCur(false);
    activeClasses.current.clear();
    thermalLogged.current = false;
    prevDets.current = [];
    setDetections([]);
    resetPlayback();
    recomputeRef();
    pushEvent('info', 'Возврат к демонстрационным сценам');
  }, [pushEvent, recomputeRef, resetPlayback, stopVideoInternal]);

  /* ---------- перемотка журнала ---------- */
  const seek = useCallback((logicalIdx: number) => {
    const arr = historyRef.current;
    let ai = logicalIdx - histBaseRef.current;
    ai = Math.max(0, Math.min(arr.length - 1, ai));
    const snap = arr[ai];
    if (!snap) return;
    followingRef.current = false;
    setFollowingState(false);
    setScrubIndex(snap.idx);
    setDisplay(snap);
  }, []);

  const followLive = useCallback(() => {
    followingRef.current = true;
    setFollowingState(true);
    const arr = historyRef.current;
    const snap = arr[arr.length - 1];
    if (snap) {
      setScrubIndex(snap.idx);
      setDisplay(snap);
    } else {
      setScrubIndex(-1);
      setDisplay(null);
    }
  }, []);

  /* ---------- основной цикл ---------- */
  useEffect(() => {
    const ac = document.createElement('canvas');
    ac.width = AW;
    ac.height = AH;
    const actx = ac.getContext('2d', { willReadFrequently: true })!;
    const noise = [makeNoiseCanvas(448, 252, 12345), makeNoiseCanvas(448, 252, 98765)];
    const heatImageData = actx.createImageData(AW, AH);
    let raf = 0;
    let lastAn = 0;
    let frames = 0;
    let fpsT = performance.now();
    let noiseFlip = 0;
    let lastVT = 0;
    let lastFrameT = performance.now();

    const analyze = () => {
      const cv = liveRef.current;
      const c = cfg.current;
      if (!cv || !refData.current) return;
      const t0 = performance.now();

      actx.drawImage(cv, 0, 0, AW, AH);
      let img: ImageData;
      try {
        img = actx.getImageData(0, 0, AW, AH);
      } catch {
        return;
      }
      const cur = img.data;
      const ref = refData.current.data;
      const N = AW * AH;
      if (!diffBuf || diffBuf.length !== N) diffBuf = new Uint8Array(N);
      const mask = new Uint8Array(N);
      let maxDiff = 0;
      const th = c.threshold;

      for (let i = 0, j = 0; i < N; i++, j += 4) {
        const dr = cur[j] - ref[j];
        const dg = cur[j + 1] - ref[j + 1];
        const db = cur[j + 2] - ref[j + 2];
        let d = (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
        if (d > 255) d = 255;
        diffBuf[i] = d;
        if (d > maxDiff) maxDiff = d;
        if (d >= th) mask[i] = 1;
      }

      const all = extractBlobs(mask, cur, diffBuf);
      const blobs = all.filter((b) => b.area >= c.minArea);
      const scale = VIEW_W / AW;

      const sevRank: Record<Severity, number> = { info: 0, warn: 1, alert: 2, critical: 3 };

      let dets: Detection[] = blobs.map((b) => {
        const cls = classifyBlob(b);
        const meta = KLASS_META[cls.klass];
        let label = meta.label;
        let thermal: Detection['thermal'];
        let thermalsArr: Detection['thermals'];
        if (cls.klass === 'fire') {
          // все локальные тепловые максимумы области
          const spots = b.thermals
            .map((s) => ({
              tempC: estimateTempC(s.lum),
              peak: s.lum,
              x: (s.x + 0.5) * scale,
              y: (s.y + 0.5) * scale,
            }))
            .filter((p) => p.tempC > 110)
            .sort((a, b2) => b2.tempC - a.tempC);
          if (spots.length) {
            thermalsArr = spots;
            thermal = spots[0]; // самая горячая — для сводных метрик
          }
          label = b.area < 120 ? 'Термоточка · очаг возгорания' : 'Возгорание';
        }
        return {
          id: `d${detSeq++}`,
          klass: cls.klass,
          label,
          confidence: cls.confidence,
          severity: meta.severity,
          bbox: {
            x: b.minX * scale,
            y: b.minY * scale,
            w: (b.maxX - b.minX + 1) * scale,
            h: (b.maxY - b.minY + 1) * scale,
          },
          area: b.area,
          areaM2: Math.round(b.area * scale * scale * PX_TO_M * PX_TO_M),
          centroid: { x: b.cx * scale, y: b.cy * scale },
          meanDiff: Math.round(b.meanDiff),
          thermal,
          thermals: thermalsArr,
        };
      });

      // Контекстная классификация: если очаг найден, нейтрально-серые пятна
      // рядом с ним — почти наверняка шлейф дыма, а не «неизвестная аномалия».
      const fireCtx = dets.filter((d) => d.klass === 'fire');
      if (fireCtx.length) {
        dets.forEach((d, i) => {
          if (d.klass !== 'unknown') return;
          const b = blobs[i];
          if (!b) return;
          const sat = Math.max(b.r, b.g, b.b) - Math.min(b.r, b.g, b.b);
          const grayish = sat < 52 && Math.abs(b.r - b.b) < 22;
          if (!grayish) return;
          const dist = Math.min(
            ...fireCtx.map((f) => Math.hypot(f.centroid.x - d.centroid.x, f.centroid.y - d.centroid.y)),
          );
          if (dist >= 320) return;
          d.klass = 'smoke';
          d.label = 'Шлейф дыма';
          d.severity = KLASS_META.smoke.severity;
          d.confidence = Math.min(0.92, Math.max(0.42, 0.5 + (52 - sat) / 104 + (1 - dist / 320) * 0.28));
        });
      }

      // связка «пожар + шлейф дыма»
      const fires = dets.filter((d) => d.klass === 'fire');
      const smokes = dets.filter((d) => d.klass === 'smoke');
      if (fires.length && smokes.length) {
        for (const f of fires) {
          const near = smokes.some(
            (s) => Math.hypot(s.centroid.x - f.centroid.x, s.centroid.y - f.centroid.y) < 240,
          );
          if (near) f.label = 'Пожар со шлейфом дыма';
        }
      }

      // временная стабилизация: сглаживание достоверности по прошлому кадру
      for (const d of dets) {
        const prev = prevDets.current.find(
          (p) =>
            p.klass === d.klass &&
            Math.hypot(p.centroid.x - d.centroid.x, p.centroid.y - d.centroid.y) < 80,
        );
        if (prev) {
          d.confidence = prev.confidence * 0.45 + d.confidence * 0.55;
          d.id = prev.id;
        }
      }
      dets.sort((a, b) => sevRank[b.severity] - sevRank[a.severity] || b.confidence - a.confidence);
      dets = dets.slice(0, 10);
      prevDets.current = dets;

      // тепловой слой
      const hc = heatRef.current;
      if (hc) {
        buildHeat(diffBuf, heatImageData);
        hc.getContext('2d')!.putImageData(heatImageData, 0, 0);
      }

      // события
      const nowActive = new Set<string>();
      for (const d of dets) {
        if (d.confidence < 0.5) continue;
        if (!nowActive.has(d.klass)) nowActive.add(d.klass);
        if (!activeClasses.current.has(d.klass)) {
          pushEvent(
            d.severity,
            `Обнаружено: ${d.label} · достоверность ${Math.round(d.confidence * 100)}%`,
          );
        }
        if (d.thermal && !thermalLogged.current) {
          thermalLogged.current = true;
          pushEvent(
            'critical',
            `ТЕРМОТОЧКА: пик ≈ ${d.thermal.tempC} °C · координаты (${Math.round(d.thermal.x)}; ${Math.round(d.thermal.y)})`,
          );
        }
      }
      for (const k of activeClasses.current) {
        if (!nowActive.has(k) && (k === 'fire' || k === 'flood' || k === 'collapse')) {
          pushEvent('info', `Признаки класса «${KLASS_META[k as keyof typeof KLASS_META].label}» более не фиксируются`);
        }
      }
      if (!nowActive.has('fire')) thermalLogged.current = false;
      activeClasses.current = nowActive;

      const thermalMax = dets.reduce((m, d) => (d.thermal && d.thermal.tempC > m ? d.thermal.tempC : m), 0);
      const peakTemp = thermalMax > 0 ? thermalMax : Math.round(17 + maxDiff * 0.22);

      const snapStatus: SystemStatus = (() => {
        const strong = dets.filter((d) => d.confidence >= 0.5);
        if (strong.some((d) => d.severity === 'critical')) return 'critical';
        if (strong.some((d) => d.severity === 'alert')) return 'alert';
        if (strong.some((d) => d.severity === 'warn')) return 'warn';
        return 'norm';
      })();

      setDetections(dets);
      setStats((s) => ({
        lastMs: Math.round((performance.now() - t0) * 10) / 10,
        segments: all.length,
        fps: s.fps,
        peakTemp,
        tick: s.tick + 1,
      }));

      /* --- журнал классификаций + перемотка --- */
      const logicalIdx = histBaseRef.current + historyRef.current.length;
      const snap: Snapshot = {
        idx: logicalIdx,
        elapsed: (performance.now() - sessionStart.current) / 1000,
        clock: new Date().toTimeString().slice(0, 8),
        dets,
        peakTemp,
        status: snapStatus,
      };
      historyRef.current.push(snap);
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift();
        histBaseRef.current++;
      }
      setHistoryLen(histBaseRef.current + historyRef.current.length);
      if (followingRef.current) setDisplay(snap);

      // строка журнала — когда изменился набор классов или прошло ≥ 2 с
      if (dets.length > 0) {
        const tick = statsRef.current.tick;
        const sig = dets.map((d) => d.klass).sort().join(',') || 'none';
        if (sig !== lastSigRef.current || tick - lastEntryTickRef.current >= 10) {
          lastSigRef.current = sig;
          lastEntryTickRef.current = tick;
          const entry: JournalEntry = {
            id: journalSeq++,
            histIdx: logicalIdx,
            elapsed: snap.elapsed,
            clock: snap.clock,
            dets,
            peakTemp,
            status: snapStatus,
            topLabel: dets[0].label,
            count: dets.length,
          };
          journalRef.current = [entry, ...journalRef.current].slice(0, MAX_JOURNAL);
          setJournal(journalRef.current);
        }
      }
    };

    const drawFrame = (now: number) => {
      const cv = liveRef.current;
      if (!cv) return;
      const ctx = cv.getContext('2d')!;
      const c = cfg.current;

      const v = videoElRef.current;
      const useVideo = videoActiveRef.current && v && v.readyState >= 2 && v.videoWidth > 0;
      if (useVideo) {
        drawCover(ctx, v!, VIEW_W, VIEW_H);
      } else {
        const cur = uploadedCurImg.current ?? camSources.current[c.cameraId];
        if (!cur) {
          ctx.fillStyle = '#0a0e14';
          ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        } else {
          drawCover(ctx, cur, VIEW_W, VIEW_H);
          const isDemoCur = !uploadedCurImg.current;
          if (isDemoCur && c.scenario !== 'calm') {
            // симуляционное время: накопленное + текущий интервал × множитель скорости
            const tSim =
              simAccum.current + ((now - scenarioStart.current) / 1000) * speedRef.current;
            drawScenario(
              ctx,
              c.scenario,
              tSim,
              now / 1000, // реальное время — для мерцания и дрейфа
              VIEW_W,
              VIEW_H,
              waterSourcesRef.current,
            );
          }
          if (isDemoCur) {
            noiseFlip ^= 1;
            ctx.globalAlpha = 0.045;
            ctx.drawImage(noise[noiseFlip], 0, 0, VIEW_W, VIEW_H);
            ctx.globalAlpha = 1;
          }
        }
      }

      const rc = refRef.current;
      if (rc) {
        const rctx = rc.getContext('2d')!;
        const rsrc = uploadedRefImg.current ?? camSources.current[c.cameraId];
        if (rsrc) drawCover(rctx, rsrc, VIEW_W, VIEW_H);
      }
    };

    const drawOverlay = (now: number) => {
      const cv = overlayRef.current;
      if (!cv) return;
      const ctx = cv.getContext('2d')!;
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      const c = cfg.current;
      if (c.viewMode === 'reference' || c.viewMode === 'compare') return;
      const dets = displayRef.current;

      if (c.overlays.grid) {
        ctx.strokeStyle = 'rgba(96,140,196,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 64; x < VIEW_W; x += 64) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, VIEW_H);
        }
        for (let y = 64; y < VIEW_H; y += 64) {
          ctx.moveTo(0, y);
          ctx.lineTo(VIEW_W, y);
        }
        ctx.stroke();
      }

      if (c.overlays.boxes) {
        ctx.font = '600 11px "JetBrains Mono", monospace';
        for (const d of dets) {
          const color = KLASS_META[d.klass].color;
          const { x, y, w, h } = d.bbox;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.4;
          ctx.strokeRect(x, y, w, h);
          ctx.lineWidth = 2.6;
          const L = Math.min(11, w / 3, h / 3);
          ctx.beginPath();
          ctx.moveTo(x, y + L); ctx.lineTo(x, y); ctx.lineTo(x + L, y);
          ctx.moveTo(x + w - L, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + L);
          ctx.moveTo(x + w, y + h - L); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - L, y + h);
          ctx.moveTo(x + L, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - L);
          ctx.stroke();
          const text = `${d.label.toUpperCase()} ${Math.round(d.confidence * 100)}%`;
          const tw = ctx.measureText(text).width;
          const ly = y - 22 < 2 ? y + h + 4 : y - 22;
          ctx.fillStyle = 'rgba(7,10,15,0.84)';
          ctx.fillRect(x, ly, tw + 22, 18);
          ctx.fillStyle = color;
          ctx.fillRect(x, ly, 3, 18);
          ctx.fillText(text, x + 9, ly + 13);
        }
      }

      if (c.overlays.thermal) {
        for (const d of dets) {
          const spots = d.thermals?.length ? d.thermals : d.thermal ? [d.thermal] : [];
          spots.forEach((tp, idx) => {
            const { x, y } = tp;
            const isHottest = idx === 0;
            // пульсирующее кольцо только у самой горячей точки
            if (isHottest) {
              const pulse = 13 + 5 * Math.sin(now / 210);
              ctx.strokeStyle = 'rgba(255,209,102,0.5)';
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.arc(x, y, pulse, 0, Math.PI * 2);
              ctx.stroke();
            }
            // маркер-перекрестие (у вторичных точек чуть меньше)
            const R = isHottest ? 7 : 5;
            const arm = isHottest ? 14 : 10;
            ctx.strokeStyle = isHottest ? '#ffd166' : 'rgba(255,209,102,0.85)';
            ctx.lineWidth = isHottest ? 1.8 : 1.4;
            ctx.beginPath();
            ctx.arc(x, y, R, 0, Math.PI * 2);
            ctx.moveTo(x - arm, y); ctx.lineTo(x - R + 3, y);
            ctx.moveTo(x + R - 3, y); ctx.lineTo(x + arm, y);
            ctx.moveTo(x, y - arm); ctx.lineTo(x, y - R + 3);
            ctx.moveTo(x, y + R - 3); ctx.lineTo(x, y + arm);
            ctx.stroke();
            // подпись температуры
            const label = `≈${tp.tempC}°C`;
            ctx.font = `${isHottest ? 700 : 600} ${isHottest ? 12 : 10.5}px "JetBrains Mono", monospace`;
            const tw = ctx.measureText(label).width;
            // чередуем сторону подписи, чтобы они не накладывались
            const tx =
              idx % 2 === 0
                ? (x + 18 + tw > VIEW_W ? x - 26 - tw : x + 18)
                : (x - 26 - tw < 0 ? x + 18 : x - 26 - tw);
            const ty = y + (idx % 3 === 2 ? 18 : 0);
            ctx.fillStyle = 'rgba(7,10,15,0.84)';
            ctx.fillRect(tx - 5, ty - 10, tw + 10, 16);
            ctx.fillStyle = isHottest ? '#ffd166' : 'rgba(255,209,102,0.92)';
            ctx.fillText(label, tx, ty + 2);
          });
        }
      }

      /* ---------- инструмент «Линейка» ---------- */
      if (rulerActiveRef.current) {
        const r = rulerRef.current;
        const cur = cursorRef.current;
        const endX = r.phase === 'live' ? (cur ? cur.x : r.ax) : r.bx;
        const endY = r.phase === 'live' ? (cur ? cur.y : r.ay) : r.by;
        const isCam4 = cfg.current.cameraId === 'cam4';

        if (r.phase !== 'idle') {
          ctx.save();
          // «бегущий пунктир»
          ctx.strokeStyle = 'rgba(233,240,248,0.92)';
          ctx.lineWidth = 1.7;
          ctx.setLineDash([7, 5]);
          ctx.lineDashOffset = -((now / 40) % 12);
          ctx.beginPath();
          ctx.moveTo(r.ax, r.ay);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.setLineDash([]);

          // концевые маркеры
          const marks: Array<[number, number]> = [[r.ax, r.ay], [endX, endY]];
          for (const [px, py] of marks) {
            ctx.fillStyle = '#0a0e14';
            ctx.beginPath();
            ctx.arc(px, py, 5.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2fd6c3';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(px, py, 5.4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#2fd6c3';
            ctx.beginPath();
            ctx.arc(px, py, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }

          // подпись расстояния у середины отрезка
          const distPx = Math.hypot(endX - r.ax, endY - r.ay);
          if (distPx > 6) {
            const label = isCam4
              ? (() => {
                  const m = distPx * mapScaleRef.current;
                  return m >= 1000
                    ? `${(m / 1000).toFixed(2).replace('.', ',')} км`
                    : `${Math.round(m)} м`;
                })()
              : `${Math.round(distPx)} px`;
            const mx = (r.ax + endX) / 2;
            const my = (r.ay + endY) / 2;
            ctx.font = '700 12px "JetBrains Mono", monospace';
            const tw = ctx.measureText(label).width;
            const bw = tw + 16;
            const bx = Math.min(VIEW_W - bw - 4, Math.max(4, mx - bw / 2));
            const by = my - 26 < 4 ? my + 10 : my - 26;
            ctx.fillStyle = 'rgba(7,10,15,0.9)';
            ctx.fillRect(bx, by, bw, 19);
            ctx.strokeStyle = 'rgba(47,214,195,0.55)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, bw, 19);
            ctx.fillStyle = '#2fd6c3';
            ctx.textAlign = 'center';
            ctx.fillText(label, bx + bw / 2, by + 13);
            ctx.textAlign = 'left';
          }
          ctx.restore();
        }
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!cfg.current.ready) return;
      drawFrame(now);
      drawOverlay(now);
      if (now - lastAn >= ANALYZE_EVERY_MS) {
        lastAn = now;
        analyze();
      }
      // видео: при ×>16 playbackRate недоступен — листаем кадры вручную
      const v = videoElRef.current;
      const dtF = (now - lastFrameT) / 1000;
      lastFrameT = now;
      if (videoActiveRef.current && v && speedRef.current > 16 && videoPlayingRef.current) {
        const dur = v.duration || 0;
        if (dur > 0) {
          let nt = v.currentTime + dtF * speedRef.current;
          if (nt >= dur) nt -= dur; // зацикливание
          v.currentTime = nt;
        }
      }
      // обновление позиции видео (для ползунка)
      if (videoActiveRef.current && v && now - lastVT > 250) {
        lastVT = now;
        setVideo((s) => (s.active ? { ...s, currentTime: v.currentTime } : s));
      }
      frames++;
      if (now - fpsT >= 1000) {
        const f = frames;
        frames = 0;
        fpsT = now;
        setStats((s) => ({ ...s, fps: f }));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // зеркало stats для использования внутри цикла (tick журнала)
  statsRef.current = stats;

  /* ---------- снимок обстановки и отчёт ---------- */
  const snapshot = useCallback(() => {
    const live = liveRef.current;
    if (!live) {
      pushToast('err', 'Видеопоток ещё не готов');
      return;
    }
    const c = cfg.current;
    const dets = displayRef.current;
    const strong = dets.filter((d) => d.confidence >= 0.5);
    const st: SystemStatus = strong.some((d) => d.severity === 'critical')
      ? 'critical'
      : strong.some((d) => d.severity === 'alert')
        ? 'alert'
        : strong.some((d) => d.severity === 'warn')
          ? 'warn'
          : 'norm';
    const STATUS_LABEL: Record<SystemStatus, { t: string; col: string }> = {
      norm: { t: 'ШТАТНО', col: '#48c96f' },
      warn: { t: 'ВНИМАНИЕ', col: '#f2a72e' },
      alert: { t: 'УГРОЗА', col: '#f07233' },
      critical: { t: 'ТРЕВОГА', col: '#f4483c' },
    };
    const cam = CAMERAS.find((x) => x.id === c.cameraId);
    const scn = SCENARIOS.find((s) => s.id === c.scenario);
    const canvas = composeDashboard({
      live,
      heat: heatRef.current,
      overlay: overlayRef.current,
      detections: dets,
      journal: journalRef.current,
      events: eventsRef.current,
      stats: statsRef.current,
      cameraName: cam?.name ?? c.cameraId,
      statusText: STATUS_LABEL[st].t,
      statusColor: STATUS_LABEL[st].col,
      scenarioTitle: scn?.title ?? c.scenario,
      threshold: c.threshold,
      minArea: c.minArea,
      speed: c.speed,
    });
    canvas.toBlob((blob) => {
      if (!blob) {
        pushToast('err', 'Не удалось сформировать PNG');
        return;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      deliver(blob, `oko_snapshot_${stamp}.png`, 'png');
      pushEvent('info', 'Сводный снимок обстановки сформирован (PNG)');
    }, 'image/png');
  }, [deliver, pushEvent, pushToast]);

  const exportReport = useCallback(() => {
    const c = cfg.current;
    const cam = CAMERAS.find((x) => x.id === c.cameraId);
    const scn = SCENARIOS.find((s) => s.id === c.scenario);
    const report = {
      system: 'ОКО v3.0',
      generatedAt: new Date().toISOString(),
      camera: cam ? cam.name : c.cameraId,
      scenario: scn ? scn.title : c.scenario,
      speed: c.speed,
      params: { threshold: c.threshold, minAreaPx: c.minArea },
      detections: displayRef.current.map((d) => ({
        class: d.klass,
        label: d.label,
        confidence: Math.round(d.confidence * 100) / 100,
        areaM2: d.areaM2,
        bbox: d.bbox,
        thermals: (d.thermals ?? (d.thermal ? [d.thermal] : [])).map((t) => ({
          tempC: t.tempC,
          x: Math.round(t.x),
          y: Math.round(t.y),
        })),
      })),
      recentEvents: eventsRef.current.slice(0, 30),
    };
    const text = JSON.stringify(report, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    deliver(blob, `oko_report_${Date.now()}.json`, 'json', text);
    pushEvent('info', 'Отчёт сформирован (JSON)');
  }, [deliver, pushEvent]);

  const status: SystemStatus = useMemo(() => {
    const strong = detections.filter((d) => d.confidence >= 0.5);
    if (strong.some((d) => d.severity === 'critical')) return 'critical';
    if (strong.some((d) => d.severity === 'alert')) return 'alert';
    if (strong.some((d) => d.severity === 'warn')) return 'warn';
    return 'norm';
  }, [detections]);

  return {
    ready,
    cameraId,
    setCamera,
    scenario,
    setScenario,
    threshold,
    setThreshold,
    minArea,
    setMinArea,
    overlays,
    toggleOverlay,
    viewMode,
    setViewMode,
    comparePos,
    setComparePos,
    detections,
    status,
    events,
    stats,
    customRef,
    customCur,
    uploadReference,
    uploadCurrent,
    resetCustom,
    snapshot,
    exportReport,
    following,
    scrubIndex,
    historyLen,
    journal,
    display,
    seek,
    followLive,
    video,
    uploadVideo,
    toggleVideoPlay,
    seekVideo,
    stopVideo,
    waterSourceCount,
    speed,
    setSpeed,
    artifact,
    clearArtifact,
    toasts,
    mapScale,
    setMapScale,
    rulerActive,
    ruler,
    toggleRuler,
    resetRuler,
    rulerClick,
    setCursor,
    bindLive,
    bindRef,
    bindHeat,
    bindOverlay,
  };
}
