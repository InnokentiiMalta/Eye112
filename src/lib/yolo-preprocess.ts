/**
 * Оптимизированная предобработка изображения для YOLO
 */

const DEFAULT_INPUT_SIZE = 640;

/**
 * Быстрая предобработка с минимальными операциями
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

  // Простой resize без letterbox для скорости
  const canvas = document.createElement('canvas');
  canvas.width = inputSize;
  canvas.height = inputSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  
  // Быстрый resize
  ctx.drawImage(
    imageDataToCanvas(imageData),
    0, 0, srcW, srcH,
    0, 0, inputSize, inputSize
  );

  const resizedData = ctx.getImageData(0, 0, inputSize, inputSize);
  const pixels = resizedData.data;

  // NCHW формат
  const hw = inputSize * inputSize;
  const tensor = new Float32Array(3 * hw);

  for (let i = 0; i < hw; i++) {
    const idx = i * 4;
    tensor[i] = pixels[idx] / 255.0;
    tensor[hw + i] = pixels[idx + 1] / 255.0;
    tensor[2 * hw + i] = pixels[idx + 2] / 255.0;
  }

  // Коэффициенты для маппинга координат
  const xRatio = srcW / inputSize;
  const yRatio = srcH / inputSize;

  return { tensor, xRatio, yRatio, offsetX: 0, offsetY: 0 };
}

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export { DEFAULT_INPUT_SIZE };
