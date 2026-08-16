// Синтетические сценарии ЧС: рисуются поверх базовой сцены в реальном времени.
// Используются для проверки конвейера обнаружения; детерминированы во времени.

import type { ScenarioId } from './types';

export const SCENARIOS: Array<{ id: ScenarioId; title: string; hint: string }> = [
  { id: 'calm', title: 'Штатный режим', hint: 'фон без аномалий' },
  { id: 'fire', title: 'Возгорание', hint: 'термоточка → пожар со шлейфом дыма' },
  { id: 'flood', title: 'Затопление', hint: 'подъём уровня воды' },
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

export function drawScenario(
  ctx: CanvasRenderingContext2D,
  id: ScenarioId,
  t: number,
  W: number,
  H: number,
) {
  ctx.save();
  switch (id) {
    case 'fire':
      drawFire(ctx, t, W, H);
      break;
    case 'flood':
      drawFlood(ctx, t, W, H);
      break;
    case 'collapse':
      drawCollapse(ctx, t, W, H);
      break;
    case 'terrain':
      drawTerrain(ctx, t, W, H);
      break;
    case 'calm':
      break;
  }
  ctx.restore();
}

/* ---------------- ПОЖАР: растущая термоточка + пламя + шлейф дыма ---------------- */
function drawFire(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
  const k = clamp01(t / 9); // рост очага за ~9 секунд
  const fx = W * 0.665;
  const fy = H * 0.585;
  const flick = Math.sin(t * 11) + Math.sin(t * 23 + 1.7) * 0.5;

  // шлейф дыма (уходит вверх-влево)
  for (let j = 0; j < 16; j++) {
    const phase = (t * 0.3 + j * 0.117) % 1.8;
    const p = phase / 1.8;
    const x = fx - p * W * 0.17 + Math.sin(t * 0.9 + j) * 10 * p;
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
    const hgt = (16 + 66 * k) * (0.65 + rnd() * 0.6) * (1 + 0.12 * Math.sin(t * 17 + i * 2.4));
    const wd = 7 + 16 * k * rnd();
    const fg = ctx.createLinearGradient(bx, fy, bx, fy - hgt);
    fg.addColorStop(0, 'rgba(255,120,26,0.85)');
    fg.addColorStop(0.45, 'rgba(255,178,54,0.62)');
    fg.addColorStop(1, 'rgba(255,232,150,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(bx - wd, fy);
    ctx.quadraticCurveTo(bx - wd * 0.7, fy - hgt * 0.55, bx + Math.sin(t * 9 + i) * 5, fy - hgt);
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
    const seed = Math.floor(t * 2.2) + i * 31;
    const er = mulberry32(seed)();
    const er2 = mulberry32(seed + 5)();
    const life = (t * 1.4 + er * 3) % 1.6;
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

/* ---------------- ЗАТОПЛЕНИЕ: поднимающаяся вода ---------------- */
function drawFlood(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
  const k = clamp01(t / 14);
  const topY = H * (0.95 - 0.37 * k);

  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, topY + Math.sin(t * 1.1) * 2);
  for (let x = 0; x <= W; x += 14) {
    const y = topY + Math.sin(x * 0.021 + t * 1.35) * 3.2 + Math.sin(x * 0.047 - t * 0.8) * 2;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();

  const wg = ctx.createLinearGradient(0, topY, 0, H);
  wg.addColorStop(0, 'rgba(52,96,168,0.56)');
  wg.addColorStop(0.4, 'rgba(38,80,148,0.64)');
  wg.addColorStop(1, 'rgba(22,56,108,0.74)');
  ctx.fillStyle = wg;
  ctx.fill();

  // блики на воде
  ctx.strokeStyle = 'rgba(215,230,245,0.14)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 9; i++) {
    const y = topY + 12 + i * 13 + Math.sin(t * 0.8 + i) * 2.4;
    if (y > H - 4) continue;
    const shift = ((t * 26 + i * 90) % (W + 220)) - 110;
    ctx.beginPath();
    ctx.moveTo(shift, y);
    ctx.lineTo(shift + 60 + (i % 3) * 42, y);
    ctx.stroke();
  }

  // кромка воды
  ctx.beginPath();
  for (let x = 0; x <= W; x += 14) {
    const y = topY + Math.sin(x * 0.021 + t * 1.35) * 3.2 + Math.sin(x * 0.047 - t * 0.8) * 2;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(205,224,240,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* ---------------- ОБРУШЕНИЕ: завал + оседающее пылевое облако ---------------- */
function drawCollapse(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
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
  const dustAlpha = Math.max(0, 0.3 - t * 0.02);
  if (dustAlpha > 0.004) {
    for (let i = 0; i < 11; i++) {
      const dx = cx + (rnd() - 0.5) * 190 - t * 6 * (i % 3 === 0 ? 1 : -0.4);
      const dy = cy - 24 + (rnd() - 0.5) * 60 - Math.min(t * 4, 26);
      const dr = 18 + Math.min(t * 15, 92) * (0.5 + rnd() * 0.6);
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

/* ---------------- СДВИГ ЛАНДШАФТА: оползень свежего грунта ---------------- */
function drawTerrain(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
  const k = clamp01(t / 7);
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
