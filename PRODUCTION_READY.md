# ✅ YOLO Fire Detector - Production Ready

## Что исправлено

### 1. Модель загружается с GitHub
- **URL по умолчанию:** `https://github.com/InnokentiiMalta/Eye112/releases/download/models-v1/fire-smoke.onnx`
- Поле URL в компоненте предзаполнено этим адресом
- Модель загружается автоматически при нажатии "Загрузить модель"

### 2. WASM файлы копируются автоматически
- Создан скрипт `copy-wasm.js` для копирования WASM файлов
- Скрипт запускается автоматически после `npm run build`
- WASM файлы копируются в `dist/assets/`
- Не нужно вручную копировать файлы из `node_modules`

### 3. ONNX Runtime правильно бандлится
- ONNX Runtime вынесен в отдельный chunk (403KB)
- Загружается только при использовании YOLO
- WASM пути настраиваются автоматически:
  - **Dev режим:** `./assets/`
  - **Electron packaged:** `window.ORT_WASM_PATH` (из preload script)

### 4. Electron интеграция
- Создан `electron/preload.cjs` для передачи путей WASM
- `electron/main.cjs` устанавливает `process.env.ORT_WASM_PATH`
- `electron-builder.yml` копирует WASM файлы в `resources/assets/`

## Структура сборки

```
dist/
├── index.html
├── assets/
│   ├── index-*.js              # Основной бандл (262KB)
│   ├── ort.bundle.min-*.js     # ONNX Runtime (403KB)
│   ├── yolo-detector-*.js      # YOLO детектор (3KB)
│   ├── hls-*.js                # HLS.js (574KB)
│   ├── index-*.css             # Стили (47KB)
│   ├── ort-wasm-simd-threaded.wasm           # WASM файлы
│   ├── ort-wasm-simd-threaded.jsep.wasm
│   ├── ort-wasm-simd-threaded.jspi.wasm
│   └── ort-wasm-simd-threaded.asyncify.wasm
```

## Использование

### Dev режим (npm run dev)

```bash
npm run dev
```

Откройте браузер → нажмите "🔥 YOLO" → выберите файл модели или загрузите по URL

**Загрузка модели:**
- **Выбор файла:** Нажмите "Выбрать файл модели" и выберите .onnx файл
- **По URL:** Модель загрузится с GitHub автоматически (или введите свой URL)

### Production сборка (npm run build)

```bash
npm run build
```

Скрипт автоматически:
1. Соберёт Vite проект
2. Скопирует WASM файлы в `dist/assets/`

### Electron сборка (npm run dist)

```bash
npm run dist
```

Electron-builder автоматически:
1. Соберёт Vite проект
2. Скопирует WASM файлы
3. Скопирует preload.cjs
4. Упакует всё в .exe

## Как это работает

### Dev режим
1. Vite dev server обслуживает файлы из `dist/`
2. WASM файлы доступны по `http://localhost:3000/assets/*.wasm`
3. ONNX Runtime загружает WASM из `./assets/`

### Production (веб)
1. Статические файлы из `dist/` загружаются на сервер
2. WASM файлы доступны по `https://your-domain.com/assets/*.wasm`
3. ONNX Runtime загружает WASM из `./assets/`

### Electron packaged
1. `electron/main.cjs` устанавливает `process.env.ORT_WASM_PATH`
2. `electron/preload.cjs` передаёт путь в renderer через `window.ORT_WASM_PATH`
3. WASM файлы находятся в `resources/assets/`
4. ONNX Runtime загружает WASM из `window.ORT_WASM_PATH`

## Проверка работоспособности

### 1. Проверьте сборку

```bash
npm run build
ls dist/assets/*.wasm
```

Должны быть 4 WASM файла:
- ort-wasm-simd-threaded.wasm
- ort-wasm-simd-threaded.jsep.wasm
- ort-wasm-simd-threaded.jspi.wasm
- ort-wasm-simd-threaded.asyncify.wasm

### 2. Проверьте dev режим

```bash
npm run dev
```

Откройте браузер → F12 → Console → нажмите "🔥 YOLO" → загрузите модель

В консоли должно быть:
```
[YoloDetector] Loading model from: https://github.com/...
[YoloDetector] WASM path: ./assets/
[YoloDetector] Model loaded successfully
```

### 3. Проверьте Electron сборку

```bash
npm run dist
```

Запустите .exe файл → нажмите "🔥 YOLO" → загрузите модель

В консоли (DevTools) должно быть:
```
[YoloDetector] Loading model from: https://github.com/...
[YoloDetector] WASM path: file://<path-to-app>/resources/assets/
[YoloDetector] Model loaded successfully
```

## Решение проблем

### Ошибка: "Failed to fetch" при загрузке модели

**Причина:** CORS или неправильный URL

**Решение:**
- Убедитесь что URL правильный: `https://github.com/InnokentiiMalta/Eye112/releases/download/models-v1/fire-smoke.onnx`
- Проверьте интернет-соединение
- GitHub может блокировать запросы без User-Agent

### Ошибка: "WASM file not found"

**Причина:** WASM файлы не скопированы

**Решение:**
```bash
npm run build
ls dist/assets/*.wasm
```

Если файлов нет, запустите вручную:
```bash
node copy-wasm.js
```

### Ошибка: "Model not loaded" в Electron

**Причина:** Неправильный путь к WASM файлам

**Решение:**
1. Проверьте что `electron/preload.cjs` существует
2. Проверьте что `electron-builder.yml` копирует WASM файлы
3. В DevTools проверьте `window.ORT_WASM_PATH`

### Медленная загрузка модели

**Причина:** Большая модель или медленный интернет

**Решение:**
- Модель ~10-20MB, загрузка зависит от скорости интернета
- Можно скачать модель вручную и положить в `public/models/`
- Изменить URL в компоненте на локальный путь

## Файлы конфигурации

### vite.config.js
```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // ...
});
```

### copy-wasm.js
Скрипт для копирования WASM файлов из `node_modules/onnxruntime-web/dist/` в `dist/assets/`

### electron-builder.yml
```yaml
files:
  - dist/**/*
  - electron/**/*
  - package.json
extraResources:
  - from: dist/assets/
    to: assets/
    filter:
      - "**/*.wasm"
```

### electron/preload.cjs
```javascript
const { contextBridge } = require('electron');
const wasmPath = process.env.ORT_WASM_PATH || './assets/';
contextBridge.exposeInMainWorld('ORT_WASM_PATH', wasmPath);
```

## Итог

✅ Модель загружается с GitHub по умолчанию  
✅ WASM файлы копируются автоматически  
✅ ONNX Runtime правильно бандлится  
✅ Работает в dev, production и Electron packaged  
✅ Не нужно вручную копировать файлы  

Готово к использованию! 🎉
