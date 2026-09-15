/**
 * Web Worker для YOLO-инференса.
 * Выполняется в отдельном потоке, не блокирует UI.
 */

import * as ort from 'onnxruntime-web';
import { preprocessImage } from './yolo-preprocess';
import { postProcess, applyNMS } from './yolo-postprocess';
import type { YoloConfig, YoloResult } from './yolo-types';

let session: ort.InferenceSession | null = null;
let config: YoloConfig = {
  scoreThreshold: 0.4,
  iouThreshold: 0.45,
  numClasses: 2,
  modelInputSize: 640,
};

// Сообщения от основного потока
self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'loadModel':
      await loadModel(payload.url);
      break;
    case 'detect':
      await detect(payload.imageData, payload.width, payload.height);
      break;
    case 'setConfig':
      config = { ...config, ...payload };
      break;
    case 'dispose':
      if (session) {
        session.release();
        session = null;
      }
      break;
  }
};

/**
 * Загрузка ONNX-модели
 */
async function loadModel(url: string): Promise<void> {
  try {
    // Настраиваем WASM (без WebGPU для совместимости)
    ort.env.wasm.numThreads = navigator.hardwareConcurrency || 2;

    session = await ort.InferenceSession.create(url, {
      executionProviders: ['wasm'],
    });

    self.postMessage({ type: 'modelLoaded', payload: { success: true } });
  } catch (error) {
    self.postMessage({
      type: 'modelLoaded',
      payload: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Инференс на изображении
 */
async function detect(
  imageDataArray: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<void> {
  if (!session) {
    self.postMessage({
      type: 'detectionResult',
      payload: { error: 'Model not loaded' },
    });
    return;
  }

  try {
    const startTime = performance.now();

    // Создаём ImageData из массива
    const clampedArray = new Uint8ClampedArray(imageDataArray);
    const imageData = new ImageData(clampedArray, width, height);

    // Предобработка
    const { tensor, xRatio, yRatio, offsetX, offsetY } = preprocessImage(
      imageData,
      config.modelInputSize,
    );

    // Создаём ONNX тензор
    const inputTensor = new ort.Tensor('float32', tensor, [
      1,
      3,
      config.modelInputSize,
      config.modelInputSize,
    ]);

    // Инференс
    const inputName = session.inputNames[0];
    const output = await session.run({ [inputName]: inputTensor });
    const outputName = session.outputNames[0];
    const outputData = output[outputName].data as Float32Array;

    // Постобработка
    const rawDetections = postProcess(
      outputData,
      config.numClasses,
      config.scoreThreshold,
      xRatio,
      yRatio,
      offsetX,
      offsetY,
      config.modelInputSize,
    );

    // NMS
    const detections = applyNMS(rawDetections, config.iouThreshold);

    const inferenceTime = performance.now() - startTime;

    self.postMessage({
      type: 'detectionResult',
      payload: { detections, inferenceTime },
    });
  } catch (error) {
    self.postMessage({
      type: 'detectionResult',
      payload: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}
