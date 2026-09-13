#!/bin/bash

# Скрипт для настройки YOLO Fire Detector
echo "🔥 Настройка YOLO Fire Detector..."

# 1. Копирование WASM файлов
echo "📦 Копирование WASM файлов..."
mkdir -p public
cp node_modules/onnxruntime-web/dist/*.wasm public/ 2>/dev/null || echo "⚠️  WASM файлы не найдены"

# 2. Создание папки для моделей
echo "📁 Создание папки для моделей..."
mkdir -p public/models

# 3. Инструкция по получению модели
echo ""
echo "✅✅✅ Базовая настройка завершена!"
echo ""
echo "📥 Следующие шаги:"
echo "1. Скачайте ONNX-модель для детекции пожаров"
echo "   Рекомендую: https://huggingface.co/SalahALHaismawi/yolov26-fire-detection"
echo ""
echo "2. Конвертируйте модель в ONNX (если нужно):"
echo "   from ultralytics import YOLO"
echo "   model = YOLO('best.pt')"
echo "   model.export(format='onnx', opset=12, dynamic=True)"
echo ""
echo "3. Поместите .onnx файл в public/models/"
echo ""
echo "4. Добавьте компонент в App.tsx:"
echo "   import YOLOFireDetector from './components/YOLOFireDetector'"
echo "   <YOLOFireDetector />"
echo ""
echo "6. Запустите: npm run dev"
echo ""
echo "📖 Подробности: YOLO_FIRE_DETECTOR_README.md"
