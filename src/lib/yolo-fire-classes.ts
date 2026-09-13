// Классы для модели детекции пожаров
export const FIRE_CLASSES: Record<number, string> = {
  0: 'fire',
  1: 'smoke',
  2: 'other',
};

export const FIRE_CLASS_COLORS: Record<string, string> = {
  fire: '#ff4444',
  smoke: '#999999',
  other: '#ff8800',
};
