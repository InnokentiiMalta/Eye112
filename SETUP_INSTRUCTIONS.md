# 🚀 Пошаговая инструкция запуска YOLO Fire Detector

## Шаг 1: Скопировать WASM-файлы

WASM-файлы нужны для работы ONNX Runtime Web. Они уже установлены в `node_modules`, их нужно скопировать в папку `public/`.

**В терминале выполните:**

```bash
# Создайте папку public (если её нет)
mkdir -p public

# Скопируйте WASM-файлы
cp node_modules/onnxruntime-web/dist/*.wasm public/
```

**Проверьте, что файлы скопировались:**
```bash
ls public/*.wasm
```

Должны появиться файлы вроде:
- `ort-wasm-simd.wasm`
- `ort-wasm.wasm`
- и другие

---

## Шаг 2: Получить ONNX-модель

### Вариант A: Скачать готовую модель (проще)

**Рекомендуемая модель:** [YOLOv26 Fire Detection](https://huggingface.co/SalahALHaismawi/yolov26-fire-detection)

**Инструкция:**

1. Перейдите по ссылке: https://huggingface.co/SalahALHaismawi/yolov26-fire-detection

2. Перейдите на вкладку **"Files and versions"**

3. Найдите файл модели (обычно `best.pt` или `model.onnx`)

4. Скачайте файл (может потребоваться аккаунт Hugging Face)

5. Если скачали `.pt` файл - перейдите к **Шагу 3** (конвертация)

6. Если скачали `.onnx` файл - перейдите к **Шагу 4** (размещение)

---

### Вариант B: Конвертировать модель из PyTorch

Если у вас есть модель в формате `.pt` (PyTorch), её нужно конвертировать в ONNX.

**Требования:**
- Python 3.8+
- Ultralytics YOLO

**Установите зависимости:**
```bash
pip install ultralytics
```

**Создайте скрипт конвертации `convert_to_onnx.py`:**

```python
from ultralytics import YOLO

# Загрузите вашу модель
model = YOLO("path/to/your/model.pt")

# Экспорт в ONNX
# opset=12 - важно для совместимости с WebGPU
# dynamic=True - поддержка разных размеров изображений
model.export(
    format="onnx",
    opset=12,
    dynamic=True,
    simplify=True
)

print("✅ Модель успешно конвертирована в ONNX!")
```

**Запустите конвертацию:**
```bash
python convert_to_onnx.py
```

После выполнения появится файл `model.onnx` (или `best.onnx`).

---

## Шаг 3: Разместить модель в проекте

**Создайте папку для моделей:**
```bash
mkdir -p public/models
```

**Скопируйте ONNX-файл:**
```bash
cp path/to/your/model.onnx public/models/fire-smoke.onnx
```

**Проверьте:**
```bash
ls -lh public/models/
```

Должен появиться файл `fire-smoke.onnx` (размер ~10-50 МБ).

---

## Шаг 4: Добавить компонент в приложение

Откройте `src/App.tsx` и добавьте импорт компонента:

```tsx
import YOLOFireDetector from './components/YOLOFireDetector';
```

Затем добавьте компонент в роутер или в нужное место:

```tsx
function App() {
  return (
    <div>
      {/* ... ваш существующий код ... */}
      
      {/* Добавьте YOLO Fire Detector */}
      <YOLOFireDetector />
    </div>
  );
}
```

**Или создайте отдельный маршрут:**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import YOLOFireDetector from './components/YOLOFireDetector';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<YourMainApp />} />
        <Route path="/yolo-detector" element={<YOLOFireDetector />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Шаг 5: Запустить приложение

```bash
npm run dev
```

Откройте браузер и перейдите к компоненту YOLOFireDetector.

---

## Шаг 6: Использовать детектор

1. **Загрузите модель:**
   - Введите в поле URL: `/models/fire-smoke.onnx`
   - Нажмите "Загрузить модель"
   - Дождитесь сообщения "✓ Модель загружена"

2. **Протестируйте:**
   - Нажмите "Загрузить изображение" и выберите фото с огнём/дымом
   - Или нажмите "Загрузить видео" и выберите видео с пожаром

3. **Результаты:**
   - На изображении/видео появятся рамки вокруг обнаруженных объектов
   - Внизу будет статистика: количество объектов, время инференса
   - Цвета рамок: красный (fire), серый (smoke), оранжевый (other)

---

## 🐛 Решение проблем

### Ошибка: "Model not loaded"

**Причина:** Модель не загружена или путь неправильный

**Решение:**
- Убедитесь, что файл лежит в `public/models/fire-smoke.onnx`
- Проверьте URL в поле ввода: должно быть `/models/fire-smoke.onnx`
- Откройте DevTools (F12) → вкладка Console → посмотрите ошибки

### Ошибка: "WebGPU is not supported"

**Причина:** Браузер не поддерживает WebGPU

**Решение:**
- Используйте Chrome/Edge последней версии
- Или включите флаг: `chrome://flags/#enable-unsafe-webgpu`
- Модель будет работать на WASM (медленнее, но совместимо)

### Ошибка: "Failed to fetch"

**Причина:** CORS-политика или неправильный путь

**Решение:**
- Убедитесь, что файл лежит в `public/` (не в `src/`)
- Проверьте, что путь начинается с `/`
- Перезапустите dev server: `npm run dev`

### Модель загружается, но ничего не детектирует

**Причина:** Порог уверенности слишком высокий или модель не подходит

**Решение:**
- Уменьшите `scoreThreshold` в `YOLOFireDetector.tsx`:
  ```typescript
  const detector = new YoloDetector({
    scoreThreshold: 0.25, // было 0.4
    iouThreshold: 0.45,
    numClasses: 3,
  });
  ```
- Проверьте, что модель обучена на fire/smoke (не на COCO)

---

## 📊 Проверка работоспособности

**Тестовые изображения:**
- Поищите в интернете: "fire detection dataset", "smoke detection images"
- Или используйте демо-изображения из репозитория модели

**Ожидаемое поведение:**
- Время инференса: 50-200 мс (WebGPU), 500-2000 мс (WASM)
- Количество детекций: зависит от изображения
- Рамки должны точно огибать огонь/дым

---

## 🎯 Что дальше?

После успешного запуска:

1. **Интеграция с ОКО:**
   - Добавить переключатель "YOLO / Эвристика"
   - Объединить результаты в общий журнал
   - Интегрировать с системой классификации

2. **Оптимизация:**
   - Использовать Web Worker для инференса
   - Добавить кэширование модели в IndexedDB
   - Оптимизировать предобработку

4. **Тестирование:**
   - Протестировать на реальных камерах
   - Настроить пороги под ваши сценарии
   - Добавить в систему алертов

---

## 📞 Нужна помощь?

Если что-то не работает:
1. Проверьте консоль браузера (F12 → Console)
3. Убедитесь, что все зависимости установлены: `npm install`
5. Проверьте, что модель в правильном формате (ONNX, opset=12)

Удачи! 🔥
