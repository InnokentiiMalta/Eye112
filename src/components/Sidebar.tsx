import { useRef, useState } from 'react';
import type { Engine } from '../lib/engine';
import { CAMERAS } from '../lib/scenes';
import { SCENARIOS } from '../lib/scenarios';
import type { ScenarioId } from '../lib/types';
import {
  IconCamera,
  IconCollapse,
  IconDroplet,
  IconEye,
  IconFlame,
  IconPause,
  IconPlay,
  IconRadar,
  IconReset,
  IconSnapshot,
  IconStop,
  IconTerrain,
  IconUpload,
  IconVideo,
} from './icons';

const SCENARIO_ICON: Record<ScenarioId, (p: { className?: string }) => React.ReactElement> = {
  calm: IconEye,
  fire: IconFlame,
  flood: IconDroplet,
  collapse: IconCollapse,
  terrain: IconTerrain,
};

const PIPELINE_STEPS = [
  'Эталонный кадр',
  'Разность кадров',
  'Пороговая фильтрация',
  'Сегментация областей',
  'Классификация аномалий',
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="hud-label mb-2 mt-5 first:mt-0">{children}</div>;
}

function fmtT(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export default function Sidebar({
  engine,
  onOpenChannel,
}: {
  engine: Engine;
  onOpenChannel: () => void;
}) {
  const refInput = useRef<HTMLInputElement>(null);
  const curInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);
  const activeStep = engine.ready ? engine.stats.tick % PIPELINE_STEPS.length : -1;
  const hasCustom = engine.customRef || engine.customCur || engine.video.active;
  const [shotBusy, setShotBusy] = useState(false);
  const channelLive = engine.channel.active && engine.channel.status.startsWith('live');

  return (
    <aside className="panel flex flex-col p-3.5">
      <SectionTitle>Камеры наблюдения</SectionTitle>
      <div className="space-y-1.5">
        {CAMERAS.map((cam) => {
          const active = engine.cameraId === cam.id;
          return (
            <button
              key={cam.id}
              onClick={() => engine.setCamera(cam.id)}
              className={`group flex w-full items-center gap-2.5 rounded-[5px] border px-2.5 py-2 text-left transition-all duration-150 ${
                active
                  ? 'border-teal/50 bg-teal/10 shadow-[0_0_14px_rgba(47,214,195,0.12)]'
                  : 'border-line bg-panel2 hover:border-line2 hover:bg-panel3'
              }`}
            >
              <IconCamera className={`h-4 w-4 shrink-0 ${active ? 'text-teal' : 'text-dim group-hover:text-mut'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[12.5px] font-semibold ${active ? 'text-fg' : 'text-mut'}`}>
                  {cam.name}
                </span>
                <span className="font-mono text-[10px] text-dim">1080p · 25 к/с · онлайн</span>
              </span>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-teal led-blink' : 'bg-okc/60'}`}
              />
            </button>
          );
        })}
      </div>
      {engine.cameraId === 'cam4' && (
        <p className="slide-in-up mt-2 rounded-[4px] border border-teal/25 bg-teal/5 px-2 py-1.5 text-[10px] leading-snug text-teal/90">
          Режим карты: «Задать масштаб» — отметьте эталонный отрезок и укажите его длину в
          метрах; «Линейка» измеряет расстояния в заданном масштабе.
        </p>
      )}

      <SectionTitle>Тестовые сценарии ЧС</SectionTitle>
      {/* множитель скорости развития */}
      <div className="mb-2 rounded-[5px] border border-line bg-panel2 px-2.5 py-2">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dim">
            Скорость развития
          </span>
          <span className="font-mono text-[11px] font-bold text-teal tabular-nums">
            ×{engine.speed}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {[1, 2, 3, 10, 50].map((v) => (
            <button
              key={v}
              onClick={() => engine.setSpeed(v)}
              className={`rounded-[4px] border px-1 py-1 font-mono text-[10.5px] font-bold transition-all duration-150 ${
                engine.speed === v
                  ? 'border-teal/60 bg-teal/15 text-teal shadow-[0_0_10px_rgba(47,214,195,0.2)]'
                  : 'border-line bg-panel text-mut hover:border-line2 hover:text-fg'
              }`}
            >
              ×{v}
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-[9px] leading-snug text-dim">
          ×1 — реалистичный темп (очаг развивается ~1,5 мин). Ускорение действует и на
          загруженное видео.
        </div>
      </div>
      <div className="space-y-1.5">
        {SCENARIOS.map((s) => {
          const Icon = SCENARIO_ICON[s.id];
          const active = engine.scenario === s.id;
          return (
            <button
              key={s.id}
              onClick={() => engine.setScenario(s.id)}
              className={`group flex w-full items-center gap-2.5 rounded-[5px] border px-2.5 py-2 text-left transition-all duration-150 ${
                active
                  ? s.id === 'calm'
                    ? 'border-okc/50 bg-okc/10'
                    : 'border-crit/50 bg-crit/10 shadow-[0_0_14px_rgba(244,72,60,0.12)]'
                  : 'border-line bg-panel2 hover:border-line2 hover:bg-panel3'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active ? (s.id === 'calm' ? 'text-okc' : 'text-crit') : 'text-dim group-hover:text-mut'
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className={`block text-[12.5px] font-semibold ${active ? 'text-fg' : 'text-mut'}`}>
                  {s.title}
                </span>
                <span className="block truncate text-[10.5px] text-dim">{s.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <SectionTitle>Входящие данные</SectionTitle>

      {/* канал видеопотока */}
      <button
        onClick={onOpenChannel}
        className={`group mb-1.5 flex w-full items-center gap-2.5 rounded-[5px] border px-2.5 py-2 text-left transition-all duration-150 ${
          channelLive
            ? 'border-crit/50 bg-crit/10 shadow-[0_0_14px_rgba(244,72,60,0.12)]'
            : 'border-line bg-panel2 hover:border-line2 hover:bg-panel3'
        }`}
      >
        <IconRadar
          className={`h-4 w-4 shrink-0 transition-colors ${
            channelLive ? 'text-crit' : 'text-dim group-hover:text-mut'
          }`}
        />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[12.5px] font-semibold ${channelLive ? 'text-fg' : 'text-mut'}`}
          >
            Канал видеопотока
          </span>
          <span className="block truncate text-[10.5px] text-dim">
            {engine.channel.active
              ? `${engine.channel.label} · ${engine.channel.status}`
              : 'сеть · локальная камера · спутниковая папка'}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.12em] ${
            channelLive
              ? 'border-crit/60 bg-crit/15 text-crit led-blink'
              : 'border-line text-dim'
          }`}
        >
          {channelLive ? 'LIVE' : 'OFF'}
        </span>
      </button>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => refInput.current?.click()}
          className={`flex flex-col items-center justify-center gap-1 rounded-[5px] border px-1 py-2 text-[10.5px] font-semibold transition-colors ${
            engine.customRef
              ? 'border-teal/50 bg-teal/10 text-teal'
              : 'border-line bg-panel2 text-mut hover:border-line2 hover:text-fg'
          }`}
        >
          <IconUpload className="h-3.5 w-3.5" /> Эталон
        </button>
        <button
          onClick={() => curInput.current?.click()}
          className={`flex flex-col items-center justify-center gap-1 rounded-[5px] border px-1 py-2 text-[10.5px] font-semibold transition-colors ${
            engine.customCur
              ? 'border-teal/50 bg-teal/10 text-teal'
              : 'border-line bg-panel2 text-mut hover:border-line2 hover:text-fg'
          }`}
        >
          <IconUpload className="h-3.5 w-3.5" /> Кадр
        </button>
        <button
          onClick={() => vidInput.current?.click()}
          className={`flex flex-col items-center justify-center gap-1 rounded-[5px] border px-1 py-2 text-[10.5px] font-semibold transition-colors ${
            engine.video.active
              ? 'border-crit/50 bg-crit/10 text-crit'
              : 'border-line bg-panel2 text-mut hover:border-line2 hover:text-fg'
          }`}
        >
          <IconVideo className="h-3.5 w-3.5" /> Видео
        </button>
      </div>
      <input
        ref={refInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) engine.uploadReference(f);
          e.target.value = '';
        }}
      />
      <input
        ref={curInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) engine.uploadCurrent(f);
          e.target.value = '';
        }}
      />
      <input
        ref={vidInput}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) engine.uploadVideo(f);
          e.target.value = '';
        }}
      />

      {/* пульт видео */}
      {engine.video.active && (
        <div className="slide-in-up mt-1.5 rounded-[5px] border border-crit/40 bg-crit/8 p-2.5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-crit led-blink" />
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-fg">
              {engine.video.name}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, engine.video.duration)}
            step={0.05}
            value={Math.min(engine.video.currentTime, engine.video.duration)}
            onChange={(e) => engine.seekVideo(Number(e.target.value))}
            aria-label="Перемотка видео"
          />
          <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] text-dim tabular-nums">
            <span>{fmtT(engine.video.currentTime)}</span>
            <span>{fmtT(engine.video.duration)}</span>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button
              onClick={engine.toggleVideoPlay}
              className="flex items-center justify-center gap-1.5 rounded-[4px] border border-line bg-panel2 px-2 py-1.5 text-[11px] font-semibold text-fg transition-colors hover:border-teal/50 hover:text-teal"
            >
              {engine.video.playing ? <IconPause className="h-3.5 w-3.5" /> : <IconPlay className="h-3.5 w-3.5" />}
              {engine.video.playing ? 'Пауза' : 'Пуск'}
            </button>
            <button
              onClick={engine.stopVideo}
              className="flex items-center justify-center gap-1.5 rounded-[4px] border border-line bg-panel2 px-2 py-1.5 text-[11px] font-semibold text-mut transition-colors hover:border-crit/50 hover:text-crit"
            >
              <IconStop className="h-3.5 w-3.5" /> Стоп
            </button>
          </div>
        </div>
      )}

      {hasCustom && (
        <button
          onClick={engine.resetCustom}
          className="slide-in-up mt-1.5 flex items-center justify-center gap-1.5 rounded-[5px] border border-warn/40 bg-warn/10 px-2 py-1.5 text-[11.5px] font-semibold text-warn transition-colors hover:bg-warn/20"
        >
          <IconReset className="h-3.5 w-3.5" /> Вернуть демо-сцены
        </button>
      )}

      {/* скриншот всей программы */}
      <button
        onClick={async () => {
          if (shotBusy) return;
          setShotBusy(true);
          try {
            await engine.snapshotFull();
          } finally {
            setShotBusy(false);
          }
        }}
        disabled={shotBusy}
        title="Снимок всего интерфейса программы в текущий момент"
        className={`mt-1.5 flex items-center justify-center gap-1.5 rounded-[5px] border px-2 py-2 text-[11.5px] font-semibold transition-all duration-150 ${
          shotBusy
            ? 'cursor-wait border-teal/40 bg-teal/10 text-teal pulse-soft'
            : 'border-line bg-panel2 text-mut hover:border-teal/50 hover:bg-teal/10 hover:text-teal'
        }`}
      >
        <IconSnapshot className="h-3.5 w-3.5" />
        {shotBusy ? 'Формируется…' : 'Скриншот всей программы'}
      </button>

      <p className="mt-2 text-[10.5px] leading-relaxed text-dim">
        Загрузите эталон («пока ничего не возникло») и кадр, видео или видеоканал с того же
        ракурса — конвейер выполнит попиксельное сравнение и классификацию в реальном времени.
      </p>

      <SectionTitle>Конвейер анализа</SectionTitle>
      <div className="rounded-[5px] border border-line bg-panel2 p-2.5">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-2.5 py-[5px]">
            <span
              className={`h-2 w-2 shrink-0 rounded-[2px] transition-all duration-200 ${
                i === activeStep ? 'bg-teal step-glow scale-110' : i < activeStep ? 'bg-teal/40' : 'bg-line2'
              }`}
            />
            <span className={`text-[11.5px] ${i === activeStep ? 'text-fg' : 'text-mut'}`}>
              {i + 1}. {step}
            </span>
            {i === activeStep && (
              <span className="ml-auto font-mono text-[10px] text-teal">{engine.stats.lastMs} мс</span>
            )}
          </div>
        ))}
        <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-line pt-2 font-mono text-[10px] text-dim">
          <span>цикл: {engine.stats.lastMs || '—'} мс</span>
          <span className="text-right">сегментов: {engine.stats.segments}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 border-t border-line pt-2 font-mono text-[10px] text-dim">
          <IconDroplet className="h-3 w-3 text-infoc/70" />
          водоисточников на эталоне: <span className="font-bold text-infoc">{engine.waterSourceCount}</span>
        </div>
      </div>
    </aside>
  );
}
