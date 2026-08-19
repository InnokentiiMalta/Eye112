// Синтетические сценарии ЧС: рисуются поверх базовой сцены в реальном времени.
// Используются для проверки конвейера обнаружения; детерминированы во времени.

import type { WaterSource } from './scenes';
import type { ScenarioId } from './types';

export const SCENARIOS: Array<{ id: ScenarioId; title: string; hint: string }> = [
  { id: 'calm', title: 'Штатный режим', hint: 'фон без аномалий' },
  { id: 'fire', title: 'Возгорание', hint: 'термоточка → пожар со шлейфом дыма' },
  { id: 'flood', title: 'Затопление', hint: 'разлив от водоисточников, подъём уровня' },
  { id: 'collapse', title: 'Обрушение', hint: 'разрушение конструкций, пыль' },
  { id: 'terrain', title: 'Сдвиг ландшафта', hint: 'оползень, вскрышной грунт' },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * tSim  — симуляционное время (сек), течёт с учётом множителя скорости;
 * tReal — реальное время (сек) для «живых» эффектов (мерцание, дрейф),
 *         которые не должны замедляться вместе со сценарием.
 */
export function drawScenario(
  ctx: CanvasRenderingContext2D,
  id: ScenarioId,
  tSim: number,
  tReal: number,
  W: number,
  H: number,
  waterSources?: WaterSource[],
) {
  ctx.save();
  switch (id) {
    case 'fire':
      drawFire(ctx, tSim, tReal, W, H);
      break;
    case 'flood':
      drawFlood(ctx, tSim, tReal, W, H, waterSources);
      break;
    case 'collapse':
      drawCollapse(ctx, tSim, tReal, W, H);
      break;
    case 'terrain':
      drawTerrain(ctx, tSim, W, H);
      break;
    case 'calm':
      break;
  }
  ctx.restore();
}

/* ---------------- ПОЖАР: растущая термоточка + пламя + шлейф дыма ---------------- */
function drawFire(
  ctx: CanvasRenderingContext2D,
  tSim: number,
  tReal: number,
  W: number,
  H: number,
) {
  const k = clamp01(tSim / 80); // реалистичный рост очага: ~80 с симуляции
  const fx = W * 0.665;
  const fy = H * 0.585;
  const flick = Math.sin(tReal * 11) + Math.sin(tReal * 23 + 1.7) * 0.5;

  // шлейф дыма (уходит вверх-влево, дрейф в реальном времени)
  for (let j = 0; j < 16; j++) {
    const phase = (tReal * 0.3 + j * 0.117) % 1.8;
    const p = phase / 1.8;
    const x = fx - p * W * 0.17 + Math.sin(tReal * 0.9 + j) * 10 * p;
    const y = fy - p * H * 0.4 - 8;
    const r = (10 + 74 * p) * (0.55 + 0.45 * k);
    const alpha = (1 - p) * 0.34 * (0.3 + 0.7 * k);
    if (alpha <= 0.01) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(148,150,152,${alpha})`);
    g.addColorStop(0.65, `rgba(140,143,146,${alpha * 0.55})`);
    g.addColorStop(1, 'rgba(135,138,141,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // внешнее свечение
  const glowR = (26 + 120 * k) * (1 + 0.05 * flick);
  const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, glowR);
  glow.addColorStop(0, `rgba(255,140,30,${0.34 * (0.25 + 0.75 * k)})`);
  glow.addColorStop(1, 'rgba(255,110,20,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(fx, fy, glowR, 0, Math.PI * 2);
  ctx.fill();

  // языки пламени
  ctx.globalCompositeOperation = 'lighter';
  const tongues = 3 + Math.round(6 * k);
  const rnd = mulberry32(777);
  for (let i = 0; i < tongues; i++) {
    const bx = fx + (rnd() - 0.5) * 34 * (0.5 + k);
    const hgt = (16 + 66 * k) * (0.65 + rnd() * 0.6) * (1 + 0.12 * Math.sin(tReal * 17 + i * 2.4));
    const wd = 7 + 16 * k * rnd();
    const fg = ctx.createLinearGradient(bx, fy, bx, fy - hgt);
    fg.addColorStop(0, 'rgba(255,120,26,0.85)');
    fg.addColorStop(0.45, 'rgba(255,178,54,0.62)');
    fg.addColorStop(1, 'rgba(255,232,150,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(bx - wd, fy);
    ctx.quadraticCurveTo(bx - wd * 0.7, fy - hgt * 0.55, bx + Math.sin(tReal * 9 + i) * 5, fy - hgt);
    ctx.quadraticCurveTo(bx + wd * 0.7, fy - hgt * 0.5, bx + wd, fy);
    ctx.closePath();
    ctx.fill();
  }

  // раскалённое ядро — будущая «термоточка»
  const coreR = (7 + 44 * k) * (1 + 0.07 * flick);
  const core = ctx.createRadialGradient(fx, fy - coreR * 0.25, 0, fx, fy - coreR * 0.25, coreR);
  core.addColorStop(0, 'rgba(255,244,205,0.98)');
  core.addColorStop(0.35, 'rgba(255,204,104,0.92)');
  core.addColorStop(0.7, 'rgba(255,138,38,0.58)');
  core.addColorStop(1, 'rgba(240,90,20,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(fx, fy - coreR * 0.25, coreR, 0, Math.PI * 2);
  ctx.fill();

  // искры
  for (let i = 0; i < 7; i++) {
    const seed = Math.floor(tReal * 2.2) + i * 31;
    const er = mulberry32(seed)();
    const er2 = mulberry32(seed + 5)();
    const life = (tReal * 1.4 + er * 3) % 1.6;
    const ex = fx + (er - 0.5) * 70 + Math.sin(life * 4 + i) * 8;
    const ey = fy - life * H * 0.16 - er2 * 20;
    const ea = Math.max(0, 0.8 - life * 0.55) * k;
    if (ea > 0.03) {
      ctx.fillStyle = `rgba(255,200,90,${ea})`;
      ctx.fillRect(ex, ey, 2.4, 2.4);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------------- ЗАТОПЛЕНИЕ: разлив от выявленных водоисточников ----------------
   Сначала у источника образуется растущее «пятно» подтопления, затем оно
   расширяется и стекает вниз, параллельно поднимается общий уровень воды.   */
function drawFlood(
  ctx: CanvasRenderingContext2D,
  tSim: number,
  tReal: number,
  W: number,
  H: number,
  sources?: WaterSource[],
) {
  const k = clamp01(tSim / 150); // полный разлив за ~2,5 минуты симуляции
  // фолбэк: если водоисточники не найдены — условный источник снизу по центру
  const srcs: WaterSource[] =
    sources && sources.length
      ? sources
      : [{ x: 0.5, y: 0.82, w: 1 }];

  /* растущие пятна подтопления у каждого водоисточника (выход из берегов) */
  for (const s of srcs) {
    const sx = s.x * W;
    const sy = s.y * H;
    const lobes = 6;
    for (let i = 0; i < lobes; i++) {
      const phase = clamp01((tSim - i * 12) / 75);
      if (phase <= 0.01) continue;
      // пятно расширяется вниз и в стороны от источника
      const spread = (i - (lobes - 1) / 2) / ((lobes - 1) / 2); // -1..1
      const cx = sx + spread * phase * W * 0.18;
      const cy = sy + phase * H * 0.22;
      const r = (20 + 120 * phase) * (0.75 + 0.25 * Math.abs(spread === 0 ? 1 : 0.8));
      const alpha = 0.56 * (0.35 + 0.65 * phase);
      const g = ctx.createRadialGradient(cx, cy - r * 0.25, r * 0.1, cx, cy, r);
      g.addColorStop(0, `rgba(64,110,178,${alpha})`);
      g.addColorStop(0.55, `rgba(42,86,150,${alpha * 0.85})`);
      g.addColorStop(1, 'rgba(30,64,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.25, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // маркер источника (тонкое кольцо, пока разлив небольшой)
    if (k < 0.6) {
      ctx.strokeStyle = `rgba(120,190,255,${0.5 * (1 - k / 0.6)})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, 12 + 8 * Math.sin(tReal * 2.2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

}

/* ---------------- ОБРУШЕНИЕ: завал + оседающее пылевое облако ----------------
   Обрушение — мгновенное событие, развивается за секунды (реалистично). */
function drawCollapse(
  ctx: CanvasRenderingContext2D,
  tSim: number,
  _tReal: number,
  W: number,
  H: number,
) {
  const cx = W * 0.215;
  const cy = H * 0.585;
  const rnd = mulberry32(4242);

  // тёмная зона разрушения
  ctx.fillStyle = 'rgba(46,44,42,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 26, 92, 66, 0, 0, Math.PI * 2);
  ctx.fill();

  // обломки
  for (let i = 0; i < 30; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * rr * 96;
    const y = cy + Math.sin(a) * rr * 36 + 6;
    const s = 5 + rnd() * 17;
    const warm = rnd();
    const base = 96 + rnd() * 74;
    ctx.fillStyle = `rgba(${base + warm * 18},${base + warm * 8},${base - 6},${0.82 + rnd() * 0.18})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    ctx.beginPath();
    ctx.moveTo(-s / 2, s * 0.3);
    ctx.lineTo(0, -s * 0.42);
    ctx.lineTo(s / 2, s * 0.24);
    ctx.lineTo(s * 0.16, s * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // трещины
  ctx.strokeStyle = 'rgba(30,28,26,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    let x = cx + (rnd() - 0.5) * 120;
    let y = cy - 40 + rnd() * 20;
    ctx.moveTo(x, y);
    for (let sgm = 0; sgm < 4; sgm++) {
      x += (rnd() - 0.5) * 34;
      y += 8 + rnd() * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // пылевое облако (оседает со временем)
  const dustAlpha = Math.max(0, 0.3 - tSim * 0.02);
  if (dustAlpha > 0.004) {
    for (let i = 0; i < 11; i++) {
      const dx = cx + (rnd() - 0.5) * 190 - tSim * 6 * (i % 3 === 0 ? 1 : -0.4);
      const dy = cy - 24 + (rnd() - 0.5) * 60 - Math.min(tSim * 4, 26);
      const dr = 18 + Math.min(tSim * 15, 92) * (0.5 + rnd() * 0.6);
      const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
      g.addColorStop(0, `rgba(168,152,134,${dustAlpha})`);
      g.addColorStop(1, 'rgba(168,152,134,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ---------------- СДВИГ ЛАНДШАФТА: оползень свежего грунта ----------------
   Сползание массива грунта — десятки секунд/минуты. */
function drawTerrain(ctx: CanvasRenderingContext2D, tSim: number, W: number, H: number) {
  const k = clamp01(tSim / 50);
  const cx = W * 0.455;
  const cy = H * 0.52;
  const s = 0.35 + 0.65 * k;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  // тело оползня
  const g = ctx.createLinearGradient(0, -60, 0, 70);
  g.addColorStop(0, 'rgba(150,110,72,0.94)');
  g.addColorStop(1, 'rgba(118,84,56,0.94)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-70, -52);
  ctx.bezierCurveTo(-20, -74, 46, -66, 74, -34);
  ctx.bezierCurveTo(96, -6, 88, 34, 56, 52);
  ctx.bezierCurveTo(18, 74, -36, 68, -66, 40);
  ctx.bezierCurveTo(-92, 16, -96, -24, -70, -52);
  ctx.closePath();
  ctx.fill();

  // борозды стока
  ctx.strokeStyle = 'rgba(104,72,46,0.6)';
  ctx.lineWidth = 3;
  const rnd = mulberry32(991);
  for (let i = 0; i < 9; i++) {
    const x0 = -56 + i * 14 + rnd() * 6;
    ctx.beginPath();
    ctx.moveTo(x0, -40 + rnd() * 16);
    ctx.quadraticCurveTo(x0 + 8 + rnd() * 10, 6, x0 - 6 + rnd() * 16, 48 + rnd() * 10);
    ctx.stroke();
  }

  // свежая кромка (светлая)
  ctx.strokeStyle = 'rgba(178,146,102,0.65)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -6, 66, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();

  // глыбы у подошвы
  for (let i = 0; i < 7; i++) {
    const x = -52 + i * 17 + rnd() * 8;
    const y = 46 + rnd() * 14;
    const rs = 4 + rnd() * 6;
    ctx.fillStyle = `rgba(${130 + rnd() * 30},${120 + rnd() * 22},${104 + rnd() * 16},0.9)`;
    ctx.beginPath();
    ctx.moveTo(x - rs, y);
    ctx.lineTo(x, y - rs);
    ctx.lineTo(x + rs, y + rs * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
