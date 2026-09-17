#!/bin/bash

# Скрипт автоматической настройки YOLO Fire Detector
echo "🔥 Настройка YOLO Fire Detector..."
echo ""

# 1. Копирование WASM файлов
echo "📦 Шаг 1: Копирование WASM файлов..."
mkdir -p public
if cp node_modules/onnxruntime-web/dist/*.wasm public/ 2>/dev/null; then
    echo "✅ WASM файлы скопированы"
else
    echo "⚠️  Не удалось скопировать WASM файлы. Попробуйте вручную:"
    echo "   cp node_modules/onnxruntime-web/dist/*.wasm public/"
fi
echo ""

# 2. Создание папки для моделей
echo "📁 Шаг 2: Создание папки для моделей..."
mkdir -p public/models
echo "✅ Папка public/models создана"
echo ""

# 3. Инструкция по получению модели
echo "📥 Шаг 3: Получение ONNX-модели"
echo ""
echo "Вариант 1: Скачать готовую модель"
echo "  - Перейдите: https://huggingface.co/SalahALHaismawi/yolov26-fire-detection"
echo "  - Скачайте модель (best.pt или model.onnx)"
echo "  - Если .pt файл - конвертируйте в ONNX (см. ниже)"
echo ""
echo "Вариант 2: Конвертировать модель из PyTorch"
echo "  - Установите: pip install ultralytics"
echo "  - Создайте файл convert.py:"
echo ""
cat << 'EOF'
from ultralytics import YOLO

model = YOLO("path/to/your/model.pt")
model.export(format="onnx", opset=12, dynamic=True, simplify=True)
print("✅ Модель конвертирована!")
EOF
echo ""
echo "  - Запустите: python convert.py"
echo ""

# 4. Размещение модели
echo "📂 Шаг 4: Разместите модель"
echo "  - Скопируйте .onnx файл в public/models/"
echo "  - Переименуйте в fire-smoke.onnx (или используйте своё имя)"
echo ""
echo "  Пример:"
echo "  cp your-model.onnx public/models/fire-smoke.onnx"
echo ""

# 5. Запуск
echo "🚀 Шаг 5: Запуск"
echo "  - Выполните: npm run dev"
echo "  - Откройте браузер"
echo "  - Нажмите кнопку '🔥 YOLO' в верхней панели"
echo "  - Введите URL модели: /models/fire-smoke.onnx"
echo "  - Нажмите 'Загрузить модель'"
echo ""

echo "✅✅✅ Настройка завершена!"
echo ""
echo "📖 Подробная инструкция: SETUP_GUIDE.md"
