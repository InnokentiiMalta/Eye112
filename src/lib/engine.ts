// Движок комплекса: rAF-цикл отрисовки, периодический прогон конвейера анализа,
// журнал событий, управление камерами/сценариями, загрузка пользовательских кадров.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AW,
  AH,
  buildHeat,
  classifyBlob,
  estimateTempC,
  extractBlobs,
} from './pipeline';
import { CAMERAS, drawCover, loadCameraSource } from './scenes';
import { drawScenario } from './scenarios';
import type {
  Detection,
  EngineStats,
  LogEvent,
  OverlaySettings,
  ScenarioId,
  Severity,
  SystemStatus,
  ViewMode,
} from './types';
import { KLASS_META } from './types';

export const VIEW_W = 896;
export const VIEW_H = 504;
const ANALYZE_EVERY_MS = 200;
const PX_TO_M = 0.42; // условный масштаб: метры на пиксель кадра

let eventSeq = 1;
let detSeq = 1;
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
  const detsRef = useRef<Detection[]>([]);
  const eventsRef = useRef<LogEvent[]>([]);

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

  detsRef.current = detections;
  eventsRef.current = events;

  const cfg = useRef({ cameraId, scenario, threshold, minArea, overlays, viewMode, ready });
  cfg.current = { cameraId, scenario, threshold, minArea, overlays, viewMode, ready };

  const pushEvent = useCallback((severity: Severity, text: string) => {
    const ev: LogEvent = {
      id: eventSeq++,
      time: new Date().toTimeString().slice(0, 8),
      severity,
      text,
    };
    setEvents((prev) => [ev, ...prev].slice(0, 80));
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
      activeClasses.current.clear();
      thermalLogged.current = false;
      prevDets.current = [];
      setDetections([]);
      if (!uploadedRefImg.current) recomputeRef();
      const cam = CAMERAS.find((c) => c.id === id);
      pushEvent('info', `Переключение на ${cam ? cam.name : id}`);
    },
    [pushEvent, recomputeRef],
  );

  const setScenario = useCallback(
    (s: ScenarioId) => {
      if (s === cfg.current.scenario) return;
      setScenarioState(s);
      cfg.current.scenario = s;
      scenarioStart.current = performance.now();
      activeClasses.current.clear();
      thermalLogged.current = false;
      prevDets.current = [];
      setDetections([]);
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
    [pushEvent],
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
        pushEvent('info', `Эталонный кадр загружен: ${file.name}`);
      });
    },
    [loadFile, pushEvent, recomputeRef],
  );

  const uploadCurrent = useCallback(
    (file: File) => {
      loadFile(file, (img) => {
        uploadedCurImg.current = img;
        setCustomCur(true);
        activeClasses.current.clear();
        thermalLogged.current = false;
        pushEvent('info', `Анализируемый кадр загружен: ${file.name}`);
      });
    },
    [loadFile, pushEvent],
  );

  const resetCustom = useCallback(() => {
    uploadedRefImg.current = null;
    uploadedCurImg.current = null;
    setCustomRef(false);
    setCustomCur(false);
    activeClasses.current.clear();
    thermalLogged.current = false;
    prevDets.current = [];
    setDetections([]);
    recomputeRef();
    pushEvent('info', 'Возврат к демонстрационным сценам');
  }, [pushEvent, recomputeRef]);

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
        if (cls.klass === 'fire') {
          const tempC = estimateTempC(b.peak);
          if (tempC > 110) {
            thermal = {
              tempC,
              peak: b.peak,
              x: (b.peakX + 0.5) * scale,
              y: (b.peakY + 0.5) * scale,
            };
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
        };
      });

      // связка «пожар + шлейф дыма»
      const fires = dets.filter((d) => d.klass === 'fire');
      const smokes = dets.filter((d) => d.klass === 'smoke');
      if (fires.length && smokes.length) {
        for (const f of fires) {
          const near = smokes.some(
            (s) => Math.hypot(s.centroid.x - f.centroid.x, s.centroid.y - f.centroid.y) < 190,
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

      setDetections(dets);
      setStats((s) => ({
        lastMs: Math.round((performance.now() - t0) * 10) / 10,
        segments: all.length,
        fps: s.fps,
        peakTemp,
        tick: s.tick + 1,
      }));
    };

    const drawFrame = (now: number) => {
      const cv = liveRef.current;
      if (!cv) return;
      const ctx = cv.getContext('2d')!;
      const c = cfg.current;
      const cur = uploadedCurImg.current ?? camSources.current[c.cameraId];
      if (!cur) {
        ctx.fillStyle = '#0a0e14';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        return;
      }
      drawCover(ctx, cur, VIEW_W, VIEW_H);
      const isDemoCur = !uploadedCurImg.current;
      if (isDemoCur && c.scenario !== 'calm') {
        drawScenario(ctx, c.scenario, (now - scenarioStart.current) / 1000, VIEW_W, VIEW_H);
      }
      if (isDemoCur) {
        noiseFlip ^= 1;
        ctx.globalAlpha = 0.045;
        ctx.drawImage(noise[noiseFlip], 0, 0, VIEW_W, VIEW_H);
        ctx.globalAlpha = 1;
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
        for (const d of detsRef.current) {
          const color = KLASS_META[d.klass].color;
          const { x, y, w, h } = d.bbox;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.4;
          ctx.strokeRect(x, y, w, h);
          // угловые метки
          ctx.lineWidth = 2.6;
          const L = Math.min(11, w / 3, h / 3);
          ctx.beginPath();
          ctx.moveTo(x, y + L); ctx.lineTo(x, y); ctx.lineTo(x + L, y);
          ctx.moveTo(x + w - L, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + L);
          ctx.moveTo(x + w, y + h - L); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - L, y + h);
          ctx.moveTo(x + L, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - L);
          ctx.stroke();
          // подпись
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
        for (const d of detsRef.current) {
          if (!d.thermal) continue;
          const { x, y } = d.thermal;
          const pulse = 13 + 5 * Math.sin(now / 210);
          ctx.strokeStyle = 'rgba(255,209,102,0.5)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(x, y, pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.moveTo(x - 14, y); ctx.lineTo(x - 4, y);
          ctx.moveTo(x + 4, y); ctx.lineTo(x + 14, y);
          ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 4);
          ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 14);
          ctx.stroke();
          const label = `≈${d.thermal.tempC}°C`;
          ctx.font = '700 12px "JetBrains Mono", monospace';
          const tw = ctx.measureText(label).width;
          const tx = x + 18 + tw > VIEW_W ? x - 26 - tw : x + 18;
          ctx.fillStyle = 'rgba(7,10,15,0.84)';
          ctx.fillRect(tx - 5, y - 10, tw + 10, 17);
          ctx.fillStyle = '#ffd166';
          ctx.fillText(label, tx, y + 3);
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
      frames++;
      if (now - fpsT >= 1000) {
        const f = frames;
        frames = 0;
        fpsT = now;
        setStats((s) => ({ ...s, fps: f }));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- снимок и отчёт ---------- */
  const snapshot = useCallback(() => {
    const cv = liveRef.current;
    if (!cv) return;
    const out = document.createElement('canvas');
    out.width = VIEW_W;
    out.height = VIEW_H;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(cv, 0, 0);
    const c = cfg.current;
    if (heatRef.current && (c.overlays.heat || c.viewMode === 'thermal')) {
      ctx.drawImage(heatRef.current, 0, 0, VIEW_W, VIEW_H);
    }
    if (overlayRef.current) ctx.drawImage(overlayRef.current, 0, 0);
    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = `pulsar_frame_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
    pushEvent('info', 'Снимок кадра сохранён (PNG)');
  }, [pushEvent]);

  const exportReport = useCallback(() => {
    const cam = CAMERAS.find((x) => x.id === cfg.current.cameraId);
    const report = {
      system: 'ПУЛЬСАР·М v2.4',
      generatedAt: new Date().toISOString(),
      camera: cam ? cam.name : cfg.current.cameraId,
      scenario: cfg.current.scenario,
      params: { threshold: cfg.current.threshold, minAreaPx: cfg.current.minArea },
      detections: detsRef.current.map((d) => ({
        class: d.klass,
        label: d.label,
        confidence: Math.round(d.confidence * 100) / 100,
        areaM2: d.areaM2,
        bbox: d.bbox,
        thermal: d.thermal ? { tempC: d.thermal.tempC, point: d.thermal } : undefined,
      })),
      recentEvents: eventsRef.current.slice(0, 30),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulsar_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushEvent('info', 'Отчёт сформирован (JSON)');
  }, [pushEvent]);

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
    bindLive,
    bindRef,
    bindHeat,
    bindOverlay,
  };
}
