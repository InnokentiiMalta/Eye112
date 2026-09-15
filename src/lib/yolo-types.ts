/**
 * Типы для YOLO Fire Detection
 */

export interface YoloDetection {
  bbox: [number, number, number, number]; // [x, y, width, height]
  classIdx: number;
  score: number;
  label: string;
  color: string;
}

export interface YoloConfig {
  scoreThreshold: number;
  iouThreshold: number;
  numClasses: number;
  modelInputSize: number;
}

export interface YoloResult {
  detections: YoloDetection[];
  inferenceTime: number;
}

// Классы для модели детекции пожаров
export const FIRE_CLASSES: Record<number, string> = {
  0: 'fire',
  1: 'smoke',
};

export const FIRE_CLASS_COLORS: Record<string, string> = {
  fire: '#ff4444',
  smoke: '#999999',
};

export const FIRE_CLASS_LABELS: Record<string, string> = {
  fire: 'Огонь',
  smoke: 'Дым',
};
