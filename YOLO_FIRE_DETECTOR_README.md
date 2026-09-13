# 🔥 YOLO Fire Detector - Прототип

Прототип интеграции YOLO для детекции пожаров через ONNX Runtime Web.

## 📋 Статус

**Прототип создан!** Компонент `YOLOFireDetector` готов к использованию.

## 🚀 Что нужно сделать

### 1. Скопировать WASM файлы

```bash
cp node_modules/onnxruntime-web/dist/*.wasm public/
```

### 2. Получить ONNX-модель

**Рекомендуемая модель:** [YOLOv26 Fire Detection](https://huggingface.co/SalahALHaismawi/yolov26-fire-detection)
- Точность: 94.9% mAP@50
- Классы: fire, smoke, other
- Лицензия: MIT

**Альтернатива:** [CVHvn/fire-smoke-detection](https://github.com/CVHvn/fire-smoke-detection)
- YOLOv11 с кодом обучения и экспорта
- 2 класса: fire, smoke

### 3. Конвертировать модель в ONNX (если нужно)

```python
from ultralytics import YOLO

# Загрузите модель
model = YOLO("best.pt")

# Экспорт в ONNX
model.export(format="onnx", opset=12, dynamic=True)
```

### 4. Поместить модель в проект

```bash
mkdir -p public/models
cp your-model.onnx public/models/fire-smoke.onnx
```

### 5. Добавить маршрут в приложение

В `src/App.tsx` добавьте:

```tsx
import YOLOFireDetector from './components/YOLOFireDetector';

// В роутере или условно:
<YOLOFireDetector />
```

### 6. Запустить

```bash
npm run dev
```

Откройте браузер и перейдите к компоненту YOLOFireDetector.

## 🏗️ Архитектура

```
src/
  lib/
    yolo-detector.ts       # Основной класс детектора
    yolo-preprocess.ts     # Предобработка изображений
    yolo-postprocess.ts    # Постобработка + NMS
    yolo-fire-classes.ts   # Классы и цвета
  components/
    YOLOFireDetector.tsx   # React-компонент прототипа
```

## ⚙️ Конфигурация

В `YOLOFireDetector.tsx` можно настроить:

```typescript
const detector = new YoloDetector({
  scoreThreshold: 0.4,    // Порог уверенности
  iouThreshold: 0.45,     // Порог NMS
  numClasses: 3,          // Количество классов в модели
});
```

## 🎯 Следующие шаги

После успешной работы прототипа:

1. **Интеграция с конвейером ОКО**
   - Объединить результаты YOLO с эвристическим анализом
   - Добавить в систему классификации
   - Интегрировать с термоточками

2. **Оптимизация**
   - Использовать Web Worker для инференса
   - Оптимизировать предобработку
   - Добавить кэширование модели

4. **UI интеграция**
   - Добавить в боковую панель
   - Интегрировать с журналом классификаций
   - Добавить переключатель YOLO/эвристика

## 🐛 Известные ограничения

- Модель должна иметь `opset=12` для совместимости с WebGPU
- Без WebGPU производительность на CPU может быть низкой
- Модель должна быть экспортирована с `dynamic=True` для поддержки разных размеров

## 📖 Источники

- [nomi30701/yolo-object-detection-onnxruntime-web](https://github.com/nomi30701/yolo-object-detection-onnxruntime-web) - основа для пред/постобработки
- [ONNX Runtime Web](https://onnxruntime.ai/) - движок инференса
- [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) - архитектура модели
