/**
 * Постобработка выходов YOLO-модели.
 * Адаптировано из nomi30701/yolo-object-detection-onnxruntime-web
 */

export interface YoloDetection {
  bbox: [number, number, number, number]; // [x, y, width, height] в координатах оригинального изображения
  classIdx: number;
  score: number;
}

/**
 * Декодирует сырой вывод модели в список детекций.
 * YOLOv8/v11/v12 формат: [1, 4+numClasses, numPredictions]
 * где 4 - это [cx, cy, w, h]
 */
export function postProcess(
  outputTensor: Float32Array,
  numClasses: number,
  scoreThreshold: number,
  xRatio: number,
  yRatio: number,
  offsetX: number,
  offsetY: number,
): YoloDetection[] {
  // outputTensor имеет форму [1, (4+numClasses), numPredictions]
  // В памяти это плоский массив: сначала все cx, потом все cy, потом w, h, потом scores для каждого класса
  const numPredictions = outputTensor.length / (4 + numClasses);

  const results: YoloDetection[] = [];

  for (let i = 0; i < numPredictions; i++) {
    // Извлекаем bbox
    const cx = outputTensor[i];
    const cy = outputTensor[numPredictions + i];
    const w = outputTensor[2 * numPredictions + i];
    const h = outputTensor[3 * numPredictions + i];

    // Находим класс с максимальной уверенностью
    let maxScore = 0;
    let classIdx = -1;

    for (let c = 0; c < numClasses; c++) {
      const score = outputTensor[(4 + c) * numPredictions + i];
      if (score > maxScore) {
        maxScore = score;
        classIdx = c;
      }
    }

    if (maxScore <= scoreThreshold) continue;

    // Преобразуем из letterbox координат в оригинальные
    // Сначала убираем padding
    const cxOrig = (cx - offsetX) * xRatio;
    const cyOrig = (cy - offsetY) * yRatio;
    const wOrig = w * xRatio;
    const hOrig = h * yRatio;

    // Преобразуем из [cx, cy, w, h] в [x, y, w, h]
    const x = cxOrig - wOrig / 2;
    const y = cyOrig - hOrig / 2;

    results.push({
      bbox: [x, y, wOrig, hOrig],
      classIdx,
      score: maxScore,
    });
  }

  return results;
}

/**
 * Non-Maximum Suppression - убирает дублирующиеся детекции.
 */
export function applyNMS(
  detections: YoloDetection[],
  iouThreshold: number = 0.45,
): YoloDetection[] {
  if (detections.length === 0) return [];

  // Сортируем по убыванию уверенности
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const selected: YoloDetection[] = [];

  while (sorted.length > 0) {
    const best = sorted.shift()!;
    selected.push(best);

    // Убираем все детекции с высоким IoU
    const remaining: YoloDetection[] = [];
    for (const det of sorted) {
      if (calculateIOU(best.bbox, det.bbox) < iouThreshold) {
        remaining.push(det);
      }
    }
    sorted.length = 0;
    sorted.push(...remaining);
  }

  return selected;
}

/**
 * Вычисляет IoU (Intersection over Union) между двумя боксами.
 */
function calculateIOU(
  box1: [number, number, number, number],
  box2: [number, number, number, number],
): number {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;

  const x1Max = x1 + w1;
  const y1Max = y1 + h1;
  const x2Max = x2 + w2;
  const y2Max = y2 + h2;

  // Пересечение
  const interX = Math.max(0, Math.min(x1Max, x2Max) - Math.max(x1, x2));
  const interY = Math.max(0, Math.min(y1Max, y2Max) - Math.max(y1, y2));
  const interArea = interX * interY;

  // Объединение
  const area1 = w1 * h1;
  const area2 = w2 * h2;
  const unionArea = area1 + area2 - interArea;

  return unionArea === 0 ? 0 : interArea / unionArea;
}
