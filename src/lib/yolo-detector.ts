/**
 * Модуль для загрузки и инференса YOLO-модели через ONNX Runtime Web.
 */

import * as ort from 'onnxruntime-web';
import { preprocessImage, MODEL_INPUT_SIZE } from './yolo-preprocess';
import { postProcess, applyNMS, type YoloDetection } from './yolo-postprocess';

export interface YoloConfig {
  scoreThreshold: number;
  iouThreshold: number;
  numClasses: number;
}

export class YoloDetector {
  private session: ort.InferenceSession | null = null;
  private config: YoloConfig;

  constructor(config: Partial<YoloConfig> = {}) {
    this.config = {
      scoreThreshold: config.scoreThreshold ?? 0.45,
      iouThreshold: config.iouThreshold ?? 0.45,
      numClasses: config.numClasses ?? 3, // fire, smoke, other
    };
  }

  /**
   * Загружает ONNX-модель из URL.
   */
  async loadModel(modelUrl: string): Promise<void> {
    try {
      // Настраиваем ONNX Runtime для использования WebGPU с фолбэком на WASM
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['webgpu', 'wasm'],
      });

      console.log('[YOLO] Model loaded successfully');
    } catch (error) {
      console.error('[YOLO] Failed to load model:', error);
      throw error;
    }
  }

  /**
   * Выполняет инференс на ImageData.
   */
  async detect(imageData: ImageData): Promise<{
    detections: YoloDetection[];
    inferenceTime: number;
  }> {
    if (!this.session) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const startTime = performance.now();

    // Предобработка
    const { tensor, xRatio, yRatio, origWidth, origHeight } = preprocessImage(imageData);

    // Создаём ONNX тензор
    const inputTensor = new ort.Tensor('float32', tensor, [
      1,
      3,
      MODEL_INPUT_SIZE,
      MODEL_INPUT_SIZE,
    ]);

    // Инференс
    const feeds: Record<string, ort.Tensor> = {};
    const inputName = this.session.inputNames[0];
    feeds[inputName] = inputTensor;

    const output = await this.session.run(feeds);
    const outputName = this.session.outputNames[0];
    const outputData = output[outputName].data as Float32Array;

    // Вычисляем offset для letterbox
    const scale = Math.min(MODEL_INPUT_SIZE / origWidth, MODEL_INPUT_SIZE / origHeight);
    const newW = Math.round(origWidth * scale);
    const newH = Math.round(origHeight * scale);
    const offsetX = (MODEL_INPUT_SIZE - newW) / 2;
    const offsetY = (MODEL_INPUT_SIZE - newH) / 2;

    // Постобработка
    const rawDetections = postProcess(
      outputData,
      this.config.numClasses,
      this.config.scoreThreshold,
      xRatio,
      yRatio,
      offsetX,
      offsetY,
    );

    // NMS
    const detections = applyNMS(rawDetections, this.config.iouThreshold);

    const inferenceTime = performance.now() - startTime;

    return { detections, inferenceTime };
  }

  /**
   * Проверяет, загружена ли модель.
   */
  isLoaded(): boolean {
    return this.session !== null;
  }

  /**
   * Освобождает ресурсы.
   */
  dispose(): void {
    if (this.session) {
      this.session.release();
      this.session = null;
    }
  }
}
