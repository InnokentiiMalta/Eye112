import { useEffect, useRef, useState } from 'react';
import { YoloDetector } from '../lib/yolo-detector';
import { FIRE_CLASSES, FIRE_CLASS_COLORS } from '../lib/yolo-fire-classes';
import type { YoloDetection } from '../lib/yolo-postprocess';

/**
 * Прототип компонента для детекции пожаров через YOLO.
 * Демонстрирует работу модели на изображениях и видео.
 */
export default function YOLOFireDetector() {
  const [detector, setDetector] = useState<YoloDetector | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<YoloDetection[]>([]);
  const [inferenceTime, setInferenceTime] = useState(0);
  const [modelUrl, setModelUrl] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number>();

  // Инициализация детектора
  useEffect(() => {
    const det = new YoloDetector({
      scoreThreshold: 0.4,
      iouThreshold: 0.45,
      numClasses: 3,
    });
    setDetector(det);

    return () => {
      det.dispose();
    };
  }, []);

  // Загрузка модели
  const handleLoadModel = async () => {
    if (!detector || !modelUrl) return;

    setLoading(true);
    setError(null);

    try {
      await detector.loadModel(modelUrl);
      setModelLoaded(true);
      console.log('[YOLOFireDetector] Model loaded');
    } catch (err) {
      setError(`Ошибка загрузки модели: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('[YOLOFireDetector] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Детекция на изображении
  const handleImageDetect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detector || !modelLoaded) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = await detector.detect(imageData);

      setDetections(result.detections);
      setInferenceTime(result.inferenceTime);

      // Рисуем результаты
      drawDetections(ctx, result.detections);
    };
    img.src = URL.createObjectURL(file);
  };

  // Детекция на видео (в реальном времени)
  const handleVideoDetect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detector || !modelLoaded) return;

    const video = videoRef.current;
    if (!video) return;

    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      video.play();
      startVideoDetection();
    };
  };

  const startVideoDetection = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !detector) return;

    const ctx = canvas.getContext('2d')!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const processFrame = async () => {
      if (video.paused || video.ended) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = await detector.detect(imageData);

      setDetections(result.detections);
      setInferenceTime(result.inferenceTime);

      drawDetections(ctx, result.detections);

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  // Остановка видео
  const stopVideo = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  // Отрисовка детекций
  const drawDetections = (ctx: CanvasRenderingContext2D, dets: YoloDetection[]) => {
    dets.forEach((det) => {
      const [x, y, w, h] = det.bbox;
      const className = FIRE_CLASSES[det.classIdx] || 'unknown';
      const color = FIRE_CLASS_COLORS[className] || '#ffffff';

      // Рамка
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Подпись
      const label = `${className} ${(det.score * 100).toFixed(1)}%`;
      ctx.font = '14px Arial';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 20, textWidth + 10, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 5, y - 5);
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔥 YOLO Fire Detector - Прототип</h1>

      {/* Загрузка модели */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">1. Загрузка модели</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={modelUrl}
            onChange={(e) => setModelUrl(e.target.value)}
            placeholder="URL ONNX модели (например, /models/fire-smoke.onnx)"
            className="flex-1 px-3 py-2 bg-gray-700 rounded text-white"
          />
          <button
            onClick={handleLoadModel}
            disabled={loading || !modelUrl}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-white font-semibold"
          >
            {loading ? 'Загрузка...' : 'Загрузить модель'}
          </button>
        </div>
        {modelLoaded && (
          <p className="mt-2 text-green-400">✓ Модель загружена</p>
        )}
        {error && (
          <p className="mt-2 text-red-400">{error}</p>
        )}
      </div>

      {/* Детекция */}
      {modelLoaded && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">2. Детекция</h2>
          <div className="flex gap-4 mb-4">
            <label className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-semibold cursor-pointer">
              Загрузить изображение
              <input
                type="file"
                accept="image/*"
                onChange={handleImageDetect}
                className="hidden"
              />
            </label>
            <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-semibold cursor-pointer">
              Загрузить видео
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoDetect}
                className="hidden"
              />
            </label>
            <button
              onClick={stopVideo}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-semibold"
            >
              Остановить видео
            </button>
          </div>

          {/* Canvas для отображения */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="max-w-full border border-gray-600 rounded"
            />
            <video
              ref={videoRef}
              className="hidden"
              playsInline
              muted
            />
          </div>

          {/* Статистика */}
          {detections.length > 0 && (
            <div className="mt-4 p-3 bg-gray-700 rounded">
              <p className="text-sm text-gray-300">
                Обнаружено объектов: <span className="font-bold text-white">{detections.length}</span>
              </p>
              <p className="text-sm text-gray-300">
                Время инференса: <span className="font-bold text-white">{inferenceTime.toFixed(2)} мс</span>
              </p>
              <div className="mt-2">
                {detections.map((det, idx) => {
                  const className = FIRE_CLASSES[det.classIdx] || 'unknown';
                  const color = FIRE_CLASS_COLORS[className] || '#ffffff';
                  return (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span
                        className="inline-block w-3 h-3 rounded"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-white">
                        {className}: {(det.score * 100).toFixed(1)}%
                      </span>
                      <span className="text-gray-400 text-xs">
                        [{det.bbox.map((v) => v.toFixed(0)).join(', ')}]
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Инструкция */}
      <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
        <h2 className="text-xl font-semibold mb-3 text-blue-300">📋 Инструкция</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-300">
          <li>
            Получите ONNX-модель для детекции пожаров. Рекомендую:
            <ul className="list-disc list-inside ml-6 mt-1 text-sm">
              <li>
                <a
                  href="https://huggingface.co/SalahALHaismawi/yolov26-fire-detection"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  YOLOv26 Fire Detection (Hugging Face)
                </a>{' '}
                - 94.9% mAP@50
              </li>
              <li>
                <a
                  href="https://github.com/CVHvn/fire-smoke-detection"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  CVHvn/fire-smoke-detection
                </a>{' '}
                - YOLOv11 с кодом экспорта
              </li>
            </ul>
          </li>
          <li>
            Конвертируйте модель в ONNX (если нужно):
            <pre className="mt-1 p-2 bg-gray-900 rounded text-xs overflow-x-auto">
{`from ultralytics import YOLO
model = YOLO("best.pt")
model.export(format="onnx", opset=12, dynamic=True)`}
            </pre>
          </li>
          <li>Поместите .onnx файл в папку <code className="bg-gray-700 px-1 rounded">public/models/</code></li>
          <li>Введите URL модели (например, <code className="bg-gray-700 px-1 rounded">/models/fire-smoke.onnx</code>)</li>
          <li>Нажмите "Загрузить модель"</li>
          <li>Загрузите изображение или видео для детекции</li>
        </ol>
      </div>
    </div>
  );
}
