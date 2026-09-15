/**
 * Предобработка изображения для YOLO-модели.
 * Использует чистый Canvas API (без OpenCV.js) для совместимости.
 */

const DEFAULT_INPUT_SIZE = 640;

/**
 * Предобрабатывает ImageData в Float32Array для ONNX-модели.
 * Применяет letterbox (сохранение пропорций + padding до квадрата).
 */
export function preprocessImage(
  imageData: ImageData,
  inputSize: number = DEFAULT_INPUT_SIZE,
): {
  tensor: Float32Array;
  xRatio: number;
  yRatio: number;
  offsetX: number;
  offsetY: number;
} {
  const srcW = imageData.width;
  const srcH = imageData.height;

  // Вычисляем масштаб для letterbox
  const scale = Math.min(inputSize / srcW, inputSize / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);

  // Создаём canvas для ресайза
  const canvas = document.createElement('canvas');
  canvas.width = inputSize;
  canvas.height = inputSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Заполняем чёрным (padding)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, inputSize, inputSize);

  // Ресайз через промежуточный canvas
  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = newW;
  resizeCanvas.height = newH;
  const resizeCtx = resizeCanvas.getContext('2d')!;
  resizeCtx.drawImage(
    imageDataToCanvas(imageData),
    0, 0, srcW, srcH,
    0, 0, newW, newH,
  );

  // Рисуем по центру
  const offsetX = Math.round((inputSize - newW) / 2);
  const offsetY = Math.round((inputSize - newH) / 2);
  ctx.drawImage(resizeCanvas, offsetX, offsetY);

  // Извлекаем пиксели и нормализуем в [0, 1]
  const resizedData = ctx.getImageData(0, 0, inputSize, inputSize);
  const pixels = resizedData.data;

  // YOLO ожидает формат NCHW: [1, 3, H, W]
  const hw = inputSize * inputSize;
  const tensor = new Float32Array(3 * hw);

  for (let i = 0; i < hw; i++) {
    const r = pixels[i * 4] / 255.0;
    const g = pixels[i * 4 + 1] / 255.0;
    const b = pixels[i * 4 + 2] / 255.0;
    tensor[i] = r;              // Channel 0: R
    tensor[hw + i] = g;         // Channel 1: G
    tensor[2 * hw + i] = b;     // Channel 2: B
  }

  // Коэффициенты для обратного маппинга координат
  const xRatio = srcW / newW;
  const yRatio = srcH / newH;

  return { tensor, xRatio, yRatio, offsetX, offsetY };
}

/**
 * Преобразует ImageData в HTMLCanvasElement
 */
function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Получает ImageData из различных источников
 */
export function getImageData(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
): ImageData {
  const w = 'videoWidth' in source ? source.videoWidth : source.width;
  const h = 'videoHeight' in source ? source.videoHeight : source.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export { DEFAULT_INPUT_SIZE };
