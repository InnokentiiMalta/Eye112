/**
 * Класс для управления YOLO-детектором через Web Worker.
 * Обеспечивает асинхронную работу без блокировки UI.
 */

import type { YoloConfig, YoloResult, YoloDetection } from './yolo-types';

export class YoloDetector {
  private worker: Worker | null = null;
  private modelLoaded = false;
  private pendingResolve: ((result: YoloResult) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;

  constructor() {
    this.initWorker();
  }

  /**
   * Инициализация Web Worker
   */
  private initWorker(): void {
    // Создаём worker из blob URL (для совместимости с Vite)
    const workerCode = `
      import * as ort from 'onnxruntime-web';
      
      let session = null;
      let config = {
        scoreThreshold: 0.4,
        iouThreshold: 0.45,
        numClasses: 2,
        modelInputSize: 640,
      };

      self.onmessage = async (e) => {
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

      async function loadModel(url) {
        try {
          ort.env.wasm.numThreads = navigator.hardwareConcurrency || 2;
          session = await ort.InferenceSession.create(url, {
            executionProviders: ['wasm'],
          });
          self.postMessage({ type: 'modelLoaded', payload: { success: true } });
        } catch (error) {
          self.postMessage({
            type: 'modelLoaded',
            payload: { success: false, error: error.message },
          });
        }
      }

      async function detect(imageDataArray, width, height) {
        if (!session) {
          self.postMessage({ type: 'detectionResult', payload: { error: 'Model not loaded' } });
          return;
        }

        try {
          const startTime = performance.now();
          const clampedArray = new Uint8ClampedArray(imageDataArray);
          const imageData = new ImageData(clampedArray, width, height);
          
          // Предобработка (letterbox)
          const inputSize = config.modelInputSize;
          const srcW = width;
          const srcH = height;
          const scale = Math.min(inputSize / srcW, inputSize / srcH);
          const newW = Math.round(srcW * scale);
          const newH = Math.round(srcH * scale);
          
          const canvas = new OffscreenCanvas(inputSize, inputSize);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, inputSize, inputSize);
          
          const resizeCanvas = new OffscreenCanvas(newW, newH);
          const resizeCtx = resizeCanvas.getContext('2d');
          const srcCanvas = new OffscreenCanvas(width, height);
          const srcCtx = srcCanvas.getContext('2d');
          srcCtx.putImageData(imageData, 0, 0);
          resizeCtx.drawImage(srcCanvas, 0, 0, width, height, 0, 0, newW, newH);
          
          const offsetX = Math.round((inputSize - newW) / 2);
          const offsetY = Math.round((inputSize - newH) / 2);
          ctx.drawImage(resizeCanvas, offsetX, offsetY);
          
          const resizedData = ctx.getImageData(0, 0, inputSize, inputSize);
          const pixels = resizedData.data;
          const hw = inputSize * inputSize;
          const tensor = new Float32Array(3 * hw);
          
          for (let i = 0; i < hw; i++) {
            tensor[i] = pixels[i * 4] / 255.0;
            tensor[hw + i] = pixels[i * 4 + 1] / 255.0;
            tensor[2 * hw + i] = pixels[i * 4 + 2] / 255.0;
          }
          
          const xRatio = srcW / newW;
          const yRatio = srcH / newH;
          
          const inputTensor = new ort.Tensor('float32', tensor, [1, 3, inputSize, inputSize]);
          const inputName = session.inputNames[0];
          const output = await session.run({ [inputName]: inputTensor });
          const outputName = session.outputNames[0];
          const outputData = output[outputName].data;
          
          // Постобработка
          const numPredictions = outputData.length / (4 + config.numClasses);
          const results = [];
          
          for (let i = 0; i < numPredictions; i++) {
            const cx = outputData[i];
            const cy = outputData[numPredictions + i];
            const w = outputData[2 * numPredictions + i];
            const h = outputData[3 * numPredictions + i];
            
            let maxScore = 0;
            let classIdx = -1;
            
            for (let c = 0; c < config.numClasses; c++) {
              const score = outputData[(4 + c) * numPredictions + i];
              if (score > maxScore) {
                maxScore = score;
                classIdx = c;
              }
            }
            
            if (maxScore <= config.scoreThreshold) continue;
            
            const cxOrig = (cx - offsetX) * xRatio;
            const cyOrig = (cy - offsetY) * yRatio;
            const wOrig = w * xRatio;
            const hOrig = h * yRatio;
            
            const x = cxOrig - wOrig / 2;
            const y = cyOrig - hOrig / 2;
            
            const labels = ['fire', 'smoke'];
            const colors = ['#ff4444', '#999999'];
            
            results.push({
              bbox: [x, y, wOrig, hOrig],
              classIdx,
              score: maxScore,
              label: labels[classIdx] || 'unknown',
              color: colors[classIdx] || '#ffffff',
            });
          }
          
          // NMS
          const selected = nms(results, config.iouThreshold);
          const inferenceTime = performance.now() - startTime;
          
          self.postMessage({
            type: 'detectionResult',
            payload: { detections: selected, inferenceTime },
          });
        } catch (error) {
          self.postMessage({
            type: 'detectionResult',
            payload: { error: error.message },
          });
        }
      }
      
      function nms(detections, iouThreshold) {
        if (detections.length === 0) return [];
        
        const byClass = new Map();
        for (const det of detections) {
          const arr = byClass.get(det.classIdx);
          if (arr) arr.push(det);
          else byClass.set(det.classIdx, [det]);
        }
        
        const result = [];
        for (const dets of byClass.values()) {
          const sorted = [...dets].sort((a, b) => b.score - a.score);
          const selected = [];
          
          while (sorted.length > 0) {
            const best = sorted.shift();
            selected.push(best);
            
            const remaining = [];
            for (const det of sorted) {
              if (calculateIOU(best.bbox, det.bbox) < iouThreshold) {
                remaining.push(det);
              }
            }
            sorted.length = 0;
            sorted.push(...remaining);
          }
          result.push(...selected);
        }
        
        return result.sort((a, b) => b.score - a.score);
      }
      
      function calculateIOU(box1, box2) {
        const [x1, y1, w1, h1] = box1;
        const [x2, y2, w2, h2] = box2;
        
        const interX = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2));
        const interY = Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2));
        const interArea = interX * interY;
        const unionArea = w1 * h1 + w2 * h2 - interArea;
        
        return unionArea === 0 ? 0 : interArea / unionArea;
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    this.worker = new Worker(workerUrl);

    this.worker.onmessage = (e) => {
      const { type, payload } = e.data;

      if (type === 'modelLoaded') {
        if (payload.success) {
          this.modelLoaded = true;
          this.pendingResolve?.({ detections: [], inferenceTime: 0 });
        } else {
          this.pendingReject?.(new Error(payload.error));
        }
        this.pendingResolve = null;
        this.pendingReject = null;
      } else if (type === 'detectionResult') {
        if (payload.error) {
          this.pendingReject?.(new Error(payload.error));
        } else {
          this.pendingResolve?.(payload as YoloResult);
        }
        this.pendingResolve = null;
        this.pendingReject = null;
      }
    };
  }

  /**
   * Загрузка модели
   */
  async loadModel(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingResolve = () => resolve();
      this.pendingReject = reject;
      this.worker?.postMessage({ type: 'loadModel', payload: { url } });
    });
  }

  /**
   * Детекция на изображении
   */
  async detect(imageData: ImageData): Promise<YoloResult> {
    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.worker?.postMessage({
        type: 'detect',
        payload: {
          imageData: imageData.data,
          width: imageData.width,
          height: imageData.height,
        },
      });
    });
  }

  /**
   * Установка конфигурации
   */
  setConfig(config: Partial<YoloConfig>): void {
    this.worker?.postMessage({ type: 'setConfig', payload: config });
  }

  /**
   * Проверка загрузки модели
   */
  isLoaded(): boolean {
    return this.modelLoaded;
  }

  /**
   * Освобождение ресурсов
   */
  dispose(): void {
    this.worker?.postMessage({ type: 'dispose' });
    this.worker?.terminate();
    this.worker = null;
    this.modelLoaded = false;
  }
}
