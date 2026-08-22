export type ScenarioId = 'calm' | 'fire' | 'flood' | 'collapse' | 'terrain';

export type ViewMode = 'live' | 'reference' | 'compare' | 'thermal';

export type Klass = 'fire' | 'smoke' | 'flood' | 'collapse' | 'terrain' | 'unknown';

export type Severity = 'info' | 'warn' | 'alert' | 'critical';

export type SystemStatus = 'norm' | 'warn' | 'alert' | 'critical';

export interface ThermalPoint {
  tempC: number;
  peak: number;
  x: number;
  y: number;
}

export interface Detection {
  id: string;
  klass: Klass;
  label: string;
  confidence: number;
  severity: Severity;
  bbox: { x: number; y: number; w: number; h: number };
  area: number;
  areaM2: number;
  centroid: { x: number; y: number };
  meanDiff: number;
  /** самая горячая термоточка (для сводных метрик и журнала) */
  thermal?: ThermalPoint;
  /** все термоточки внутри аномалии */
  thermals?: ThermalPoint[];
}

export interface LogEvent {
  id: number;
  time: string;
  severity: Severity;
  text: string;
}

export interface EngineStats {
  lastMs: number;
  segments: number;
  fps: number;
  peakTemp: number;
  tick: number;
}

/** Снимок состояния конвейера в один момент анализа — основа журнала с перемоткой. */
export interface Snapshot {
  idx: number;
  elapsed: number;
  clock: string;
  dets: Detection[];
  peakTemp: number;
  status: SystemStatus;
}

/** Строка журнала классификаций (момент, когда набор аномалий изменился). */
export interface JournalEntry {
  id: number;
  histIdx: number;
  elapsed: number;
  clock: string;
  dets: Detection[];
  peakTemp: number;
  status: SystemStatus;
  topLabel: string;
  count: number;
}

export interface VideoState {
  active: boolean;
  playing: boolean;
  name: string;
  duration: number;
  currentTime: number;
}

export interface OverlaySettings {
  boxes: boolean;
  heat: boolean;
  grid: boolean;
  thermal: boolean;
}

/** Всплывающее уведомление о результате действия. */
export interface ToastMsg {
  id: number;
  kind: 'ok' | 'err';
  text: string;
}

/** Сформированный файл (снимок/отчёт) для скачивания и предпросмотра. */
export interface Artifact {
  kind: 'png' | 'json';
  name: string;
  url: string;
  text?: string;
}

/** Состояние инструмента «Линейка». */
export interface RulerState {
  phase: 'idle' | 'live' | 'done';
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** Состояние калибровки масштаба эталонным отрезком. */
export interface CalibState {
  phase: 'idle' | 'live' | 'done';
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export const KLASS_META: Record<Klass, { color: string; label: string; severity: Severity }> = {
  fire: { color: '#ff5a36', label: 'Возгорание', severity: 'critical' },
  smoke: { color: '#9fb0c4', label: 'Шлейф дыма', severity: 'warn' },
  flood: { color: '#5aa2f0', label: 'Затопление территории', severity: 'alert' },
  collapse: { color: '#f07233', label: 'Разрушение конструкций', severity: 'alert' },
  terrain: { color: '#a3b34d', label: 'Изменение ландшафта', severity: 'warn' },
  unknown: { color: '#8494ab', label: 'Неклассифицированная аномалия', severity: 'info' },
};

export const SEVERITY_META: Record<Severity, { color: string; label: string }> = {
  info: { color: '#5aa2f0', label: 'ИНФО' },
  warn: { color: '#f2a72e', label: 'ВНИМАНИЕ' },
  alert: { color: '#f07233', label: 'УГРОЗА' },
  critical: { color: '#f4483c', label: 'ТРЕВОГА' },
};
