/**
 * Предобработка изображения для YOLO-модели.
 * Адаптировано из nomi30701/yolo-object-detection-onnxruntime-web
 */

const MODEL_INPUT_SIZE = 640; // YOLO по умолчанию принимает 640x640

/**
 * Предобрабатывает ImageData в Float32Array для ONNX-модели.
 * Применяет letterbox (сохранение пропорций + padding до квадрата).
 *
 * @returns [inputTensor, xRatio, yRatio] - тензор и коэффициенты масштабирования
 */
export function preprocessImage(
  imageData: ImageData,
): { tensor: Float32Array; xRatio: number; yRatio: number; origWidth: number; origHeight: number } {
  const srcW = imageData.width;
  const srcH = imageData.height;

  // Вычисляем масштаб для letterbox
  const scale = Math.min(MODEL_INPUT_SIZE / srcW, MODEL_INPUT_SIZE / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);

  // Создаём canvas для ресайза
  const canvas = document.createElement('canvas');
  canvas.width = MODEL_INPUT_SIZE;
  canvas.height = MODEL_INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Заполняем чёрным (padding)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

  // Рисуем изображение по центру с сохранением пропорций
  const offsetX = Math.round((MODEL_INPUT_SIZE - newW) / 2);
  const offsetY = Math.round((MODEL_INPUT_SIZE - newH) / 2);

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

  ctx.drawImage(resizeCanvas, offsetX, offsetY);

  // Извлекаем пиксели и нормализуем в [0, 1]
  const resizedData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const pixels = resizedData.data;

  // YOLO ожидает формат NCHW: [1, 3, H, W]
  const tensor = new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
  const hw = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;

  for (let i = 0; i < hw; i++) {
    const r = pixels[i * 4] / 255.0;
    const g = pixels[i * 4 + 1] / 255.0;
    const b = pixels[i * 4 + 2] / 255.0;
    tensor[i] = r;                    // Channel 0: R
    tensor[hw + i] = g;               // Channel 1: G
    tensor[2 * hw + i] = b;           // Channel 2: B
  }

  // Коэффициенты для обратного маппинга координат
  const xRatio = srcW / newW;
  const yRatio = srcH / newH;

  return { tensor, xRatio, yRatio, origWidth: srcW, origHeight: srcH };
}

/**
 * Преобразует ImageData в HTMLCanvasElement для drawImage
 */
function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export { MODEL_INPUT_SIZE };
