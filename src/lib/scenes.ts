// Источники сцен для камер наблюдения + процедурный фолбэк,
// если удалённое изображение недоступно (или заблокировано CORS).

export interface CameraDef {
  id: string;
  name: string;
  short: string;
  src: string;
}

export const CAMERAS: CameraDef[] = [
  {
    id: 'cam1',
    name: 'Камера 01 · Лесная промзона',
    short: 'КАМ-01',
    src: 'https://image.qwenlm.ai/generated-images/60e30582-1d58-4610-97d7-a82cbc463a58/_result.png',
  },
  {
    id: 'cam2',
    name: 'Камера 02 · Резервуарный парк',
    short: 'КАМ-02',
    src: 'https://image.qwenlm.ai/generated-images/52cb0b5b-956a-45b3-979c-fa7110b93339/_result.png',
  },
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

/** Загружает изображение и проверяет, что пиксели читаемы (CORS-safe). */
export function loadCameraSource(src: string, camIndex: number): Promise<CanvasImageSource> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const fallback = () => resolve(makeSyntheticScene(camIndex));
    img.onerror = fallback;
    img.onload = () => {
      try {
        const probe = document.createElement('canvas');
        probe.width = 8;
        probe.height = 8;
        const pc = probe.getContext('2d')!;
        pc.drawImage(img, 0, 0, 8, 8);
        pc.getImageData(0, 0, 1, 1);
        resolve(img);
      } catch {
        fallback();
      }
    };
    img.src = src;
  });
}

function sourceDims(src: CanvasImageSource): { w: number; h: number } {
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth || 1280, h: src.naturalHeight || 720 };
  if (src instanceof HTMLCanvasElement) return { w: src.width, h: src.height };
  if (typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement)
    return { w: src.videoWidth || 1280, h: src.videoHeight || 720 };
  return { w: 1280, h: 720 };
}

/** Отрисовка с заполнением рамки (cover). */
export function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, w: number, h: number) {
  const { w: sw, h: sh } = sourceDims(src);
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export interface WaterSource {
  x: number; // нормированные координаты 0..1
  y: number;
  w: number; // доля водных пикселей
}

/**
 * Выявление зон водоисточников на эталонном снимке:
 * поиск пикселей с доминирующим синим каналом и кластеризация по сетке.
 */
export function detectWaterSources(img: ImageData): WaterSource[] {
  const W = img.width;
  const H = img.height;
  const d = img.data;
  const GW = 20;
  const GH = 12;
  const grid = new Float32Array(GW * GH);
  let total = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 4;
      const r = d[j];
      const g = d[j + 1];
      const b = d[j + 2];
      if (b - r > 18 && b - g > 6 && b > 60) {
        const gx = Math.min(GW - 1, Math.floor((x / W) * GW));
        const gy = Math.min(GH - 1, Math.floor((y / H) * GH));
        grid[gy * GW + gx]++;
        total++;
      }
    }
  }
  if (total < 30) return [];
  const cells: Array<{ i: number; v: number }> = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] >= 3) cells.push({ i, v: grid[i] });
  if (!cells.length) return [];
  cells.sort((a, b) => b.v - a.v);
  return cells.slice(0, 4).map((c) => ({
    x: ((c.i % GW) + 0.5) / GW,
    y: (Math.floor(c.i / GW) + 0.5) / GH,
    w: c.v / total,
  }));
}

/** Процедурная сцена (фолбэк): склад у лесополосы / резервуарный парк. */
export function makeSyntheticScene(idx: number): HTMLCanvasElement {
  const W = 1280;
  const H = 720;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(idx === 0 ? 1101 : 2202);

  // небо
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.4);
  sky.addColorStop(0, idx === 0 ? '#9fb2bd' : '#a3aeb6');
  sky.addColorStop(1, '#c2cbc9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.4);

  // земля
  const gr = ctx.createLinearGradient(0, H * 0.34, 0, H);
  if (idx === 0) {
    gr.addColorStop(0, '#7d8a6c');
    gr.addColorStop(0.5, '#6c7a5e');
    gr.addColorStop(1, '#5c6b50');
  } else {
    gr.addColorStop(0, '#8a8578');
    gr.addColorStop(0.5, '#7b766a');
    gr.addColorStop(1, '#6b675c');
  }
  ctx.fillStyle = gr;
  ctx.fillRect(0, H * 0.34, W, H * 0.66);

  if (idx === 0) {
    // лес справа
    for (let i = 0; i < 46; i++) {
      const x = W * 0.62 + rnd() * W * 0.38;
      const y = H * 0.34 + rnd() * H * 0.42;
      const s = 14 + rnd() * 26 + (y / H) * 22;
      ctx.fillStyle = `rgb(${38 + rnd() * 22},${64 + rnd() * 26},${44 + rnd() * 18})`;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // склады слева
    for (let b = 0; b < 2; b++) {
      const bx = W * 0.05 + b * W * 0.16;
      const by = H * 0.46 + b * H * 0.06;
      const bw = W * 0.14;
      const bh = H * 0.13;
      ctx.fillStyle = '#8d949b';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#6e757c';
      ctx.beginPath();
      ctx.moveTo(bx - 6, by);
      ctx.lineTo(bx + bw / 2, by - bh * 0.32);
      ctx.lineTo(bx + bw + 6, by);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5d646b';
      ctx.fillRect(bx + bw * 0.42, by + bh * 0.5, bw * 0.16, bh * 0.5);
    }
    // дорога
    ctx.fillStyle = '#9a8f7a';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.78);
    ctx.lineTo(W * 0.62, H * 0.6);
    ctx.lineTo(W * 0.66, H * 0.64);
    ctx.lineTo(0, H * 0.88);
    ctx.closePath();
    ctx.fill();
    // река снизу
    ctx.fillStyle = '#5f7f8a';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.93);
    ctx.quadraticCurveTo(W * 0.4, H * 0.88, W, H * 0.95);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  } else {
    // резервуары
    for (let t = 0; t < 4; t++) {
      const tx = W * 0.1 + (t % 2) * W * 0.28;
      const ty = H * 0.4 + Math.floor(t / 2) * H * 0.18;
      const tw = W * 0.18;
      const th = H * 0.14;
      ctx.fillStyle = '#b9bec2';
      ctx.fillRect(tx, ty, tw, th);
      ctx.fillStyle = '#d3d7da';
      ctx.beginPath();
      ctx.ellipse(tx + tw / 2, ty, tw / 2, th * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8b9094';
      ctx.fillRect(tx, ty + th * 0.45, tw, 3);
      ctx.fillRect(tx, ty + th * 0.75, tw, 3);
    }
    // трубопровод
    ctx.strokeStyle = '#9aa0a5';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.62);
    ctx.lineTo(W, H * 0.55);
    ctx.stroke();
    // обвалование
    ctx.strokeStyle = '#7d786c';
    ctx.lineWidth = 10;
    ctx.strokeRect(W * 0.07, H * 0.37, W * 0.5, H * 0.36);
    // грунтовая дорога
    ctx.fillStyle = '#8d8272';
    ctx.fillRect(0, H * 0.8, W, H * 0.08);
  }

  // зерно текстуры
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * W;
    const y = H * 0.3 + rnd() * H * 0.7;
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},0,${0.015 + rnd() * 0.03})`;
    ctx.fillRect(x, y, 2, 2);
  }
  return c;
}
