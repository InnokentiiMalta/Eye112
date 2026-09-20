/**
 * Постобработка выходов YOLO-модели.
 * Декодирование + Non-Maximum Suppression.
 */

import { FIRE_CLASSES, FIRE_CLASS_COLORS, type YoloDetection } from './yolo-types';

/**
 * Сигмоида - преобразует логиты в вероятности [0, 1]
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Декодирует сырой вывод модели в список детекций.
 * Упрощённая версия без letterbox маппинга.
 */
export function postProcess(
  outputTensor: Float32Array,
  numClasses: number,
  scoreThreshold: number,
  xRatio: number,
  yRatio: number,
): YoloDetection[] {
  const numPredictions = outputTensor.length / (4 + numClasses);
  const results: YoloDetection[] = [];

  for (let i = 0; i < numPredictions; i++) {
    const cx = outputTensor[i];
    const cy = outputTensor[numPredictions + i];
    const w = outputTensor[2 * numPredictions + i];
    const h = outputTensor[3 * numPredictions + i];

    let maxScore = 0;
    let classIdx = -1;

    for (let c = 0; c < numClasses; c++) {
      const rawScore = outputTensor[(4 + c) * numPredictions + i];
      // Применяем сигмоиду для преобразования логитов в вероятности
      const score = sigmoid(rawScore);
      if (score > maxScore) {
        maxScore = score;
        classIdx = c;
      }
    }

    if (maxScore <= scoreThreshold) continue;

    // Простой маппинг координат
    const x = (cx - w / 2) * xRatio;
    const y = (cy - h / 2) * yRatio;
    const wOrig = w * xRatio;
    const hOrig = h * yRatio;

    const label = FIRE_CLASSES[classIdx] || 'unknown';
    const color = FIRE_CLASS_COLORS[label] || '#ffffff';

    results.push({
      bbox: [x, y, wOrig, hOrig],
      classIdx,
      score: maxScore,
      label,
      color,
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

  // Группируем по классам
  const byClass = new Map<number, YoloDetection[]>();
  for (const det of detections) {
    const arr = byClass.get(det.classIdx);
    if (arr) arr.push(det);
    else byClass.set(det.classIdx, [det]);
  }

  const result: YoloDetection[] = [];

  // NMS для каждого класса отдельно
  for (const dets of byClass.values()) {
    const sorted = [...dets].sort((a, b) => b.score - a.score);
    const selected: YoloDetection[] = [];

    while (sorted.length > 0) {
      const best = sorted.shift()!;
      selected.push(best);

      const remaining: YoloDetection[] = [];
      for (const det of sorted) {
        if (calculateIOU(best.bbox, det.bbox) < iouThreshold) {
          remaining.push(det);
        }
      }
      sorted.length = 0;
      sorted.push(...remaining);
    }

    result.push(...selected);
  }

  // Сортируем по уверенности
  return result.sort((a, b) => b.score - a.score);
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

  const interX = Math.max(0, Math.min(x1Max, x2Max) - Math.max(x1, x2));
  const interY = Math.max(0, Math.min(y1Max, y2Max) - Math.max(y1, y2));
  const interArea = interX * interY;

  const area1 = w1 * h1;
  const area2 = w2 * h2;
  const unionArea = area1 + area2 - interArea;

  return unionArea === 0 ? 0 : interArea / unionArea;
}
