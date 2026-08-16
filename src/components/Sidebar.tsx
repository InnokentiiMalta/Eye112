import { useRef } from 'react';
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
  IconReset,
  IconTerrain,
  IconUpload,
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

export default function Sidebar({ engine }: { engine: Engine }) {
  const refInput = useRef<HTMLInputElement>(null);
  const curInput = useRef<HTMLInputElement>(null);
  const activeStep = engine.ready ? engine.stats.tick % PIPELINE_STEPS.length : -1;
  const hasCustom = engine.customRef || engine.customCur;

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

      <SectionTitle>Тестовые сценарии ЧС</SectionTitle>
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

      <SectionTitle>Собственные кадры</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => refInput.current?.click()}
          className={`flex items-center justify-center gap-1.5 rounded-[5px] border px-2 py-2 text-[11.5px] font-semibold transition-colors ${
            engine.customRef
              ? 'border-teal/50 bg-teal/10 text-teal'
              : 'border-line bg-panel2 text-mut hover:border-line2 hover:text-fg'
          }`}
        >
          <IconUpload className="h-3.5 w-3.5" /> Эталон
        </button>
        <button
          onClick={() => curInput.current?.click()}
          className={`flex items-center justify-center gap-1.5 rounded-[5px] border px-2 py-2 text-[11.5px] font-semibold transition-colors ${
            engine.customCur
              ? 'border-teal/50 bg-teal/10 text-teal'
              : 'border-line bg-panel2 text-mut hover:border-line2 hover:text-fg'
          }`}
        >
          <IconUpload className="h-3.5 w-3.5" /> Кадр
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
      {hasCustom && (
        <button
          onClick={engine.resetCustom}
          className="slide-in-up mt-1.5 flex items-center justify-center gap-1.5 rounded-[5px] border border-warn/40 bg-warn/10 px-2 py-1.5 text-[11.5px] font-semibold text-warn transition-colors hover:bg-warn/20"
        >
          <IconReset className="h-3.5 w-3.5" /> Вернуть демо-сцены
        </button>
      )}
      <p className="mt-2 text-[10.5px] leading-relaxed text-dim">
        Загрузите эталон («пока ничего не возникло») и кадр с событием — конвейер выполнит
        попиксельное сравнение и классификацию.
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
      </div>
    </aside>
  );
}
