/**
 * Упрощённый YOLO детектор (без Web Worker для оптимизации)
 */

import type { YoloConfig, YoloResult, YoloDetection } from './yolo-types';
import { preprocessImage } from './yolo-preprocess';
import { postProcess, applyNMS } from './yolo-postprocess';

export class YoloDetector {
  private session: any = null;
  private config: YoloConfig = {
    scoreThreshold: 0.4,
    iouThreshold: 0.45,
    numClasses: 2,
    modelInputSize: 640,
  };

  /**
   * Загрузка модели
   */
  async loadModel(url: string): Promise<void> {
    try {
      // Динамический импорт ONNX Runtime
      const ort = await import('onnxruntime-web');
      
      // Настраиваем WASM
      ort.env.wasm.numThreads = 1; // Один поток для экономии ресурсов
      
      this.session = await ort.InferenceSession.create(url, {
        executionProviders: ['wasm'],
      });
    } catch (error) {
      console.error('[YoloDetector] Load error:', error);
      throw error;
    }
  }

  /**
   * Детекция на изображении
   */
  async detect(imageData: ImageData): Promise<YoloResult> {
    if (!this.session) {
      throw new Error('Model not loaded');
    }

    const startTime = performance.now();

    // Предобработка
    const { tensor, xRatio, yRatio, offsetX, offsetY } = preprocessImage(
      imageData,
      this.config.modelInputSize,
    );

    // Создаём ONNX тензор
    const ort = await import('onnxruntime-web');
    const inputTensor = new ort.Tensor('float32', tensor, [
      1,
      3,
      this.config.modelInputSize,
      this.config.modelInputSize,
    ]);

    // Инференс
    const inputName = this.session.inputNames[0];
    const output = await this.session.run({ [inputName]: inputTensor });
    const outputName = this.session.outputNames[0];
    const outputData = output[outputName].data as Float32Array;

    // Постобработка
    const rawDetections = postProcess(
      outputData,
      this.config.numClasses,
      this.config.scoreThreshold,
      xRatio,
      yRatio,
    );

    // NMS
    const detections = applyNMS(rawDetections, this.config.iouThreshold);

    const inferenceTime = performance.now() - startTime;

    return { detections, inferenceTime };
  }

  /**
   * Установка конфигурации
   */
  setConfig(config: Partial<YoloConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Проверка загрузки модели
   */
  isLoaded(): boolean {
    return this.session !== null;
  }

  /**
   * Освобождение ресурсов
   */
  dispose(): void {
    if (this.session) {
      this.session.release();
      this.session = null;
    }
  }
}
