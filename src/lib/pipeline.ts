// Конвейер анализа: разность с эталоном -> порог -> сегментация -> классификация.
// Всё выполняется попиксельно в реальном времени на canvas.

import type { Klass } from './types';

export const AW = 320; // разрешение анализа
export const AH = 180;

export interface ThermalSpot {
  x: number;
  y: number;
  lum: number;
}

export interface Blob {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  r: number;
  g: number;
  b: number;
  meanDiff: number;
  peak: number;
  peakX: number;
  peakY: number;
  /** все локальные тепловые максимумы внутри области (отсортированы по убыванию яркости) */
  thermals: ThermalSpot[];
}

/**
 * Поиск локальных максимумов яркости внутри связной области.
 * Пиксель считается локальным максимумом, если его яркость не меньше яркости
 * всех соседних пикселей маски в окне 3×3. Затем применяется подавление
 * немаксимумов: точки ближе MIN_DIST друг к другу сливаются, остаётся самая яркая.
 */
function findLocalMaxima(
  mask: Uint8Array,
  frame: Uint8ClampedArray,
  members: number[],
  maxCount: number,
): ThermalSpot[] {
  const lumAt = (i: number) => {
    const j = i * 4;
    return 0.299 * frame[j] + 0.587 * frame[j + 1] + 0.114 * frame[j + 2];
  };

  const candidates: ThermalSpot[] = [];
  for (const i of members) {
    const x = i % AW;
    const y = (i / AW) | 0;
    const lum = lumAt(i);
    let isMax = true;
    for (let dy = -1; dy <= 1 && isMax; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= AH) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= AW) continue;
        const ni = ny * AW + nx;
        // сравниваем только с пикселями той же маски
        if (mask[ni] && lumAt(ni) > lum) {
          isMax = false;
          break;
        }
      }
    }
    if (isMax) candidates.push({ x, y, lum });
  }

  // подавление немаксимумов: сливаем близко расположенные точки
  candidates.sort((a, b) => b.lum - a.lum);
  const MIN_DIST = 6; // px в координатах анализа
  const kept: ThermalSpot[] = [];
  for (const c of candidates) {
    if (kept.length >= maxCount) break;
    const tooClose = kept.some(
      (k) => Math.hypot(k.x - c.x, k.y - c.y) < MIN_DIST,
    );
    if (!tooClose) kept.push(c);
  }
  return kept;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Выделение связных областей (8-связность, BFS) из бинарной маски различий.
 * Возвращает ВСЕ области (фильтрация по площади — снаружи).
 */
export function extractBlobs(
  mask: Uint8Array,
  frame: Uint8ClampedArray,
  diff: Uint8Array,
): Blob[] {
  const N = AW * AH;
  const visited = new Uint8Array(N);
  const stack: number[] = [];
  const out: Blob[] = [];

  for (let start = 0; start < N; start++) {
    if (!mask[start] || visited[start]) continue;
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;

    let area = 0;
    let minX = AW, minY = AH, maxX = -1, maxY = -1;
    let sx = 0, sy = 0, sr = 0, sg = 0, sb = 0, sd = 0;
    let peak = -1, peakX = 0, peakY = 0;
    const members: number[] = [];

    while (stack.length) {
      const i = stack.pop()!;
      const x = i % AW;
      const y = (i / AW) | 0;
      area++;
      members.push(i);
      sx += x; sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const j = i * 4;
      const r = frame[j], g = frame[j + 1], b = frame[j + 2];
      sr += r; sg += g; sb += b;
      const d = diff[i];
      sd += d;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > peak) { peak = lum; peakX = x; peakY = y; }

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= AH) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= AW) continue;
          const ni = ny * AW + nx;
          if (mask[ni] && !visited[ni]) {
            visited[ni] = 1;
            stack.push(ni);
          }
        }
      }
    }

    // локальные тепловые максимумы ищем только у областей заметного размера
    const thermals = area >= 12 ? findLocalMaxima(mask, frame, members, 5) : [];

    out.push({
      area,
      minX, minY, maxX, maxY,
      cx: sx / area,
      cy: sy / area,
      r: sr / area,
      g: sg / area,
      b: sb / area,
      meanDiff: sd / area,
      peak,
      peakX,
      peakY,
      thermals,
    });
  }
  return out;
}

export interface ClassifyResult {
  klass: Klass;
  confidence: number;
}

/**
 * Эвристическая классификация аномалии по спектральным признакам
 * области в текущем кадре.
 */
export function classifyBlob(b: Blob): ClassifyResult {
  const cr = b.r, cg = b.g, cb = b.b;
  const maxC = Math.max(cr, cg, cb);
  const minC = Math.min(cr, cg, cb);
  const sat = maxC - minC;
  const lum = 0.3 * cr + 0.55 * cg + 0.15 * cb;

  // Пожар: горячие красно-оранжевые пиксели с высокой разностью
  if (cr > 128 && cr - cg > 20 && cr - cb > 26 && b.meanDiff > 42) {
    return {
      klass: 'fire',
      confidence: clamp01(0.48 + (cr - cg) / 240 + b.meanDiff / 520),
    };
  }

  // Затопление: синева доминирует
  if (cb - cr > 14 && cb - cg > 5) {
    return {
      klass: 'flood',
      confidence: clamp01(0.5 + (cb - cr) / 220 + Math.min(b.area / 3200, 0.22)),
    };
  }

  // Дым: нейтральный серый, без выраженного цветового сдвига
  if (sat < 40 && Math.abs(cr - cb) < 15 && lum > 92 && lum < 224) {
    return {
      klass: 'smoke',
      confidence: clamp01(0.46 + (40 - sat) / 90 + Math.min(b.area / 2600, 0.2)),
    };
  }

  // Разрушение: тёплый серый (бетон/пыль), умеренная насыщенность
  if (sat < 66 && cr - cb > 5 && cr - cb < 56 && lum > 92 && lum < 212) {
    return {
      klass: 'collapse',
      confidence: clamp01(0.5 + Math.min(b.meanDiff / 320, 0.22) + Math.min(b.area / 2400, 0.16)),
    };
  }

  // Изменение ландшафта: вскрышной грунт — выраженный тёплый тон
  if (cr - cg > 10 && cg > cb && sat >= 44 && cr - cb >= 46) {
    return {
      klass: 'terrain',
      confidence: clamp01(0.5 + Math.min(b.area / 2600, 0.26) + (sat - 44) / 260),
    };
  }

  return { klass: 'unknown', confidence: clamp01(0.34 + Math.min(b.meanDiff / 400, 0.12)) };
}

/* ---------- тепловой слой (палитра «тепловизор»: холодный синий -> янтарный -> белый) ---------- */

const HEAT_STOPS: Array<[number, number, number, number]> = [
  [0.0, 10, 16, 38],
  [0.2, 34, 66, 168],
  [0.4, 28, 150, 190],
  [0.58, 96, 208, 140],
  [0.72, 246, 196, 66],
  [0.86, 248, 106, 38],
  [1.0, 255, 244, 214],
];

export function heatColor(t: number): [number, number, number] {
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    if (t <= HEAT_STOPS[i][0]) {
      const [t0, r0, g0, b0] = HEAT_STOPS[i - 1];
      const [t1, r1, g1, b1] = HEAT_STOPS[i];
      const k = (t - t0) / (t1 - t0);
      return [r0 + (r1 - r0) * k, g0 + (g1 - g0) * k, b0 + (b1 - b0) * k];
    }
  }
  return [255, 244, 214];
}

/** Заполняет ImageData (AW*AH) тепловым представлением массива различий. */
export function buildHeat(diff: Uint8Array, out: ImageData) {
  const data = out.data;
  for (let i = 0, j = 0; i < diff.length; i++, j += 4) {
    const t = diff[i] / 255;
    const [r, g, b] = heatColor(t);
    data[j] = r;
    data[j + 1] = g;
    data[j + 2] = b;
    data[j + 3] = t < 0.09 ? t * 400 : Math.min(255, Math.pow(t, 1.35) * 300);
  }
}

/** Оценка температуры термоточки по пиковой яркости (демонстрационная шкала, °C). */
export function estimateTempC(peakLum: number): number {
  return Math.round(36 + Math.pow(Math.max(0, peakLum) / 255, 1.6) * 520);
}
