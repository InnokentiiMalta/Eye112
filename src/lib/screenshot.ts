// Сводный скриншот обстановки: видео со слоями + все панели и показатели,
// отрисованные на едином canvas (работает в любой среде, без DOM-захвата).

import type { Detection, EngineStats, JournalEntry, LogEvent } from './types';
import { KLASS_META, SEVERITY_META } from './types';

const W = 1700;
const H = 1140;
const PAD = 24;

const STATUS_COLOR: Record<string, string> = {
  norm: '#48c96f',
  warn: '#f2a72e',
  alert: '#f07233',
  critical: '#f4483c',
};

const BG = '#0a0e14';
const PANEL_FILL = '#101724';
const LINE = '#223046';
const FG = '#d9e2ee';
const MUT = '#8494ab';
const DIM = '#5c6c85';
const TEAL = '#2fd6c3';

export interface SnapshotInput {
  live: HTMLCanvasElement;
  heat: HTMLCanvasElement | null;
  overlay: HTMLCanvasElement | null;
  detections: Detection[];
  journal: JournalEntry[];
  events: LogEvent[];
  stats: EngineStats;
  cameraName: string;
  statusText: string;
  statusColor: string;
  scenarioTitle: string;
  threshold: number;
  minArea: number;
  speed: number;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 8) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string) {
  rr(ctx, x, y, w, h);
  ctx.fillStyle = PANEL_FILL;
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = '700 13px "IBM Plex Sans", sans-serif';
  ctx.fillStyle = DIM;
  ctx.textAlign = 'left';
  ctx.fillText(title.toUpperCase(), x + 14, y + 22);
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 32);
  ctx.lineTo(x + w - 12, y + 32);
  ctx.stroke();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

export function composeDashboard(inp: SnapshotInput): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  // фон + сетка
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120,150,190,0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < W; x += 46) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y < H; y += 46) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  /* ---------- шапка ---------- */
  const now = new Date();
  ctx.textAlign = 'left';
  ctx.fillStyle = TEAL;
  ctx.beginPath();
  ctx.arc(PAD + 8, 36, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '800 26px "Unbounded", "IBM Plex Sans", sans-serif';
  ctx.fillStyle = FG;
  ctx.fillText('ОКО', PAD + 26, 45);
  ctx.font = '600 13px "IBM Plex Sans", sans-serif';
  ctx.fillStyle = MUT;
  ctx.fillText('комплекс видеоаналитики чрезвычайных ситуаций', PAD + 96, 43);

  // статус-чип
  ctx.font = '800 14px "JetBrains Mono", monospace';
  const stW = ctx.measureText(inp.statusText).width + 28;
  rr(ctx, W - PAD - stW - 330, 20, stW, 30, 5);
  ctx.fillStyle = inp.statusColor + '22';
  ctx.fill();
  ctx.strokeStyle = inp.statusColor;
  ctx.stroke();
  ctx.fillStyle = inp.statusColor;
  ctx.fillText(inp.statusText, W - PAD - stW - 316, 40);

  ctx.textAlign = 'right';
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillStyle = FG;
  ctx.fillText(now.toLocaleTimeString('ru-RU'), W - PAD, 34);
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = DIM;
  ctx.fillText(now.toLocaleDateString('ru-RU') + ' · ' + inp.cameraName, W - PAD, 50);
  ctx.textAlign = 'left';

  /* ---------- видео ---------- */
  const vx = PAD;
  const vy = 76;
  const vw = 1100;
  const vh = Math.round((vw * 9) / 16);
  rr(ctx, vx, vy, vw, vh);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#05080d';
  ctx.fillRect(vx, vy, vw, vh);
  ctx.drawImage(inp.live, vx, vy, vw, vh);
  if (inp.heat) {
    ctx.globalAlpha = 0.62;
    ctx.drawImage(inp.heat, vx, vy, vw, vh);
    ctx.globalAlpha = 1;
  }
  if (inp.overlay) ctx.drawImage(inp.overlay, vx, vy, vw, vh);
  // сканирующая линия
  const sy = vy + ((Date.now() / 4600) % 1) * vh;
  const sg = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
  sg.addColorStop(0, 'rgba(47,214,195,0)');
  sg.addColorStop(0.5, 'rgba(47,214,195,0.09)');
  sg.addColorStop(1, 'rgba(47,214,195,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(vx, sy - 30, vw, 60);
  ctx.restore();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  rr(ctx, vx, vy, vw, vh);
  ctx.stroke();
  // угловые метки
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 2.5;
  const L = 20;
  const cx0 = vx + 8, cy0 = vy + 8, cx1 = vx + vw - 8, cy1 = vy + vh - 8;
  ctx.beginPath();
  ctx.moveTo(cx0, cy0 + L); ctx.lineTo(cx0, cy0); ctx.lineTo(cx0 + L, cy0);
  ctx.moveTo(cx1 - L, cy0); ctx.lineTo(cx1, cy0); ctx.lineTo(cx1, cy0 + L);
  ctx.moveTo(cx1, cy1 - L); ctx.lineTo(cx1, cy1); ctx.lineTo(cx1 - L, cy1);
  ctx.moveTo(cx0 + L, cy1); ctx.lineTo(cx0, cy1); ctx.lineTo(cx0, cy1 - L);
  ctx.stroke();
  // HUD поверх видео
  ctx.font = '700 14px "JetBrains Mono", monospace';
  ctx.fillStyle = TEAL;
  ctx.fillText(inp.cameraName.toUpperCase() + '  ·  ' + inp.scenarioTitle.toUpperCase(), vx + 20, vy + 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = inp.stats.peakTemp > 110 ? '#f4483c' : inp.stats.peakTemp > 55 ? '#f2a72e' : TEAL;
  ctx.fillText('T-МАКС ' + inp.stats.peakTemp + '°C', vx + vw - 20, vy + 28);
  ctx.textAlign = 'left';
  ctx.fillStyle = MUT;
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText('● REC · ' + now.toLocaleTimeString('ru-RU') + ' · скорость ×' + inp.speed, vx + 20, vy + vh - 14);
  ctx.textAlign = 'right';
  ctx.fillStyle = DIM;
  ctx.fillText('Δ-порог ' + inp.threshold + ' · мин. область ' + inp.minArea + ' px', vx + vw - 20, vy + vh - 14);
  ctx.textAlign = 'left';

  /* ---------- метрики под видео ---------- */
  const my = vy + vh + 16;
  const mw = (vw - 3 * 14) / 4;
  const metrics: Array<[string, string, string]> = [
    ['АНАЛИЗ', String(inp.stats.lastMs || '—'), 'мс'],
    ['СЕГМЕНТОВ', String(inp.stats.segments), ''],
    ['КАДР', String(inp.stats.fps), 'к/с'],
    ['T-МАКС', String(inp.stats.peakTemp), '°C'],
  ];
  metrics.forEach(([k, v, u], i) => {
    const x = vx + i * (mw + 14);
    rr(ctx, x, my, mw, 66);
    ctx.fillStyle = PANEL_FILL;
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.stroke();
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = DIM;
    ctx.fillText(k, x + 14, my + 24);
    ctx.font = '800 24px "JetBrains Mono", monospace';
    ctx.fillStyle = FG;
    ctx.fillText(v, x + 14, my + 52);
    if (u) {
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillStyle = DIM;
      ctx.fillText(u, x + 18 + ctx.measureText(v).width + 14, my + 52);
    }
  });

  /* ---------- нижняя левая зона: журналы ---------- */
  const ly = my + 66 + 16;
  const lh = H - ly - PAD;
  const lw = (vw - 14) / 2;

  panel(ctx, vx, ly, lw, lh, 'Журнал событий');
  ctx.font = '500 12.5px "IBM Plex Sans", sans-serif';
  const evRows = inp.events.slice(0, 9);
  evRows.forEach((ev, i) => {
    const y = ly + 54 + i * ((lh - 62) / 9);
    ctx.fillStyle = SEVERITY_META[ev.severity].color;
    ctx.beginPath();
    ctx.arc(vx + 20, y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = DIM;
    ctx.fillText(ev.time, vx + 32, y);
    ctx.font = '500 12.5px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = ev.severity === 'critical' ? '#f4483c' : '#c4cfdd';
    ctx.fillText(truncate(ctx, ev.text, lw - 120), vx + 104, y);
  });

  panel(ctx, vx + lw + 14, ly, lw, lh, 'Журнал классификаций');
  ctx.font = '500 12.5px "IBM Plex Sans", sans-serif';
  const jRows = inp.journal.slice(0, 9);
  jRows.forEach((e, i) => {
    const y = ly + 54 + i * ((lh - 62) / 9);
    ctx.fillStyle = STATUS_COLOR[e.status] ?? DIM;
    ctx.beginPath();
    ctx.arc(vx + lw + 14 + 20, y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    const mm = Math.floor(e.elapsed / 60);
    const ss = String(Math.floor(e.elapsed % 60)).padStart(2, '0');
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = DIM;
    ctx.fillText(`t+${mm}:${ss}`, vx + lw + 14 + 32, y);
    ctx.font = '500 12.5px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = '#c4cfdd';
    ctx.fillText(
      truncate(ctx, e.topLabel + (e.count > 1 ? ` +${e.count - 1}` : ''), lw - 190),
      vx + lw + 14 + 104,
      y,
    );
    if (e.peakTemp > 40) {
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'right';
      ctx.fillText(e.peakTemp + '°', vx + 2 * lw + 14 - 14, y);
      ctx.textAlign = 'left';
    }
  });

  /* ---------- правая колонка ---------- */
  const rx = vx + vw + 16;
  const rw = W - rx - PAD;
  let ry = vy;

  // классификация аномалий
  const dets = inp.detections.slice(0, 6);
  const ch = 44 + Math.max(1, dets.length) * 46 + 14;
  panel(ctx, rx, ry, rw, ch, 'Классификация аномалий');
  if (dets.length === 0) {
    ctx.font = '500 13px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = DIM;
    ctx.fillText('Расхождений с эталоном выше порога нет', rx + 14, ry + 58);
  }
  dets.forEach((d, i) => {
    const meta = KLASS_META[d.klass];
    const y = ry + 48 + i * 46;
    ctx.fillStyle = meta.color;
    ctx.fillRect(rx + 14, y, 4, 32);
    ctx.font = '700 13.5px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = FG;
    ctx.fillText(truncate(ctx, d.label, rw - 130), rx + 28, y + 14);
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = meta.color;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(d.confidence * 100) + '%', rx + rw - 14, y + 14);
    ctx.textAlign = 'left';
    // бар достоверности
    rr(ctx, rx + 28, y + 22, rw - 42, 5, 2);
    ctx.fillStyle = '#1a2434';
    ctx.fill();
    if (d.confidence > 0.01) {
      rr(ctx, rx + 28, y + 22, (rw - 42) * d.confidence, 5, 2);
      ctx.fillStyle = meta.color;
      ctx.fill();
    }
  });
  ry += ch + 14;

  // термоточки
  const thermals = inp.detections.flatMap((d) =>
    (d.thermals ?? (d.thermal ? [d.thermal] : [])).map((t, i) => ({ ...t, hottest: i === 0, label: d.label })),
  );
  thermals.sort((a, b) => b.tempC - a.tempC);
  const th = 44 + Math.max(1, Math.min(5, thermals.length)) * 30 + 10;
  panel(ctx, rx, ry, rw, th, 'Термоточки');
  if (thermals.length === 0) {
    ctx.font = '500 13px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = DIM;
    ctx.fillText('Локальных тепловых максимумов не зафиксировано', rx + 14, ry + 58);
  }
  thermals.slice(0, 5).forEach((t, i) => {
    const y = ry + 58 + i * 30;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(rx + 20, y - 4, t.hottest ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`≈${t.tempC}°C`, rx + 34, y);
    if (t.hottest) {
      ctx.font = '800 9px "JetBrains Mono", monospace';
      const bw = ctx.measureText('МАКС').width + 12;
      rr(ctx, rx + 110, y - 13, bw, 16, 3);
      ctx.fillStyle = 'rgba(255,209,102,0.15)';
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.fillText('МАКС', rx + 116, y - 1);
    }
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = DIM;
    ctx.textAlign = 'right';
    ctx.fillText(`(${Math.round(t.x)}; ${Math.round(t.y)})`, rx + rw - 14, y);
    ctx.textAlign = 'left';
  });
  ry += th + 14;

  // параметры
  const ph = 130;
  panel(ctx, rx, ry, rw, ph, 'Параметры конвейера');
  ctx.font = '500 13px "IBM Plex Sans", sans-serif';
  const params: Array<[string, string]> = [
    ['Порог различий Δ', String(inp.threshold)],
    ['Минимальная область', inp.minArea + ' px'],
    ['Скорость развития', '×' + inp.speed],
  ];
  params.forEach(([k, v], i) => {
    const y = ry + 58 + i * 26;
    ctx.fillStyle = MUT;
    ctx.fillText(k, rx + 14, y);
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillStyle = TEAL;
    ctx.textAlign = 'right';
    ctx.fillText(v, rx + rw - 14, y);
    ctx.textAlign = 'left';
    ctx.font = '500 13px "IBM Plex Sans", sans-serif';
  });

  // подпись
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = DIM;
  ctx.fillText('Сформировано системой ОКО · ' + now.toISOString(), rx, H - PAD - 4);

  return c;
}
