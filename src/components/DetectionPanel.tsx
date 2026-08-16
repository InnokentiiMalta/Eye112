import type { Engine } from '../lib/engine';
import type { Klass, SystemStatus } from '../lib/types';
import { KLASS_META } from '../lib/types';
import {
  IconCheck,
  IconCollapse,
  IconDroplet,
  IconFlame,
  IconPulse,
  IconSmoke,
  IconTerrain,
  IconThermo,
  IconUnknown,
} from './icons';

const KLASS_ICON: Record<Klass, (p: { className?: string }) => React.ReactElement> = {
  fire: IconFlame,
  smoke: IconSmoke,
  flood: IconDroplet,
  collapse: IconCollapse,
  terrain: IconTerrain,
  unknown: IconUnknown,
};

const STATUS_WORD: Record<SystemStatus, { word: string; cls: string; note: string }> = {
  norm: { word: 'НОРМА', cls: 'text-okc', note: 'сцена соответствует эталону' },
  warn: { word: 'ВНИМАНИЕ', cls: 'text-warn', note: 'обнаружены отклонения от эталона' },
  alert: { word: 'УГРОЗА', cls: 'text-alert', note: 'признаки развивающейся ЧС' },
  critical: { word: 'ТРЕВОГА', cls: 'text-crit', note: 'обнаружена активная ЧС' },
};

export default function DetectionPanel({ engine }: { engine: Engine }) {
  const st = STATUS_WORD[engine.status];
  const thermals = engine.detections.filter((d) => d.thermal);
  const strong = engine.detections.filter((d) => d.confidence >= 0.5);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* статус */}
      <div className="panel relative overflow-hidden p-4">
        <div
          className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl ${
            engine.status === 'critical'
              ? 'bg-crit/20'
              : engine.status === 'alert'
                ? 'bg-alert/15'
                : engine.status === 'warn'
                  ? 'bg-warn/10'
                  : 'bg-okc/10'
          }`}
        />
        <div className="hud-label">Статус сцены</div>
        <div className={`font-display text-[26px] font-bold leading-tight ${st.cls}`}>{st.word}</div>
        <div className="mt-0.5 text-[11.5px] text-mut">{st.note}</div>
        <div className="mt-3 flex items-center gap-2 font-mono text-[10.5px] text-dim">
          <IconPulse className="h-3.5 w-3.5 text-teal" />
          объектов: {strong.length} · анализ каждые 200 мс
        </div>
      </div>

      {/* классификация */}
      <div className="panel flex-1 p-3.5">
        <div className="hud-label mb-2">Классификация аномалий</div>
        {engine.detections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-7 text-center">
            <IconCheck className="h-8 w-8 text-okc/70" />
            <div className="text-[12px] text-mut">
              Расхождений с эталоном выше порога нет.
              <br />
              <span className="text-dim">Сцена стабильна.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {engine.detections.map((d) => {
              const Icon = KLASS_ICON[d.klass];
              const meta = KLASS_META[d.klass];
              return (
                <div
                  key={d.id}
                  className="slide-in-up rounded-[5px] border border-line bg-panel2 p-2.5 transition-transform duration-150 hover:-translate-y-px hover:border-line2"
                  style={{ borderLeft: `3px solid ${meta.color}` }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-fg">
                      {d.label}
                    </span>
                    <span
                      className="rounded-[3px] px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-wider"
                      style={{ color: meta.color, background: `${meta.color}1f` }}
                    >
                      {Math.round(d.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.round(d.confidence * 100)}%`, background: meta.color }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9.5px] text-dim">
                    <span>площадь ≈ {d.areaM2} м²</span>
                    <span>Δ-сигнал {d.meanDiff}</span>
                    <span>
                      ({Math.round(d.centroid.x)}; {Math.round(d.centroid.y)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* термоточки */}
      <div className="panel p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="hud-label">Термоточки</div>
          <IconThermo className={`h-4 w-4 ${thermals.length ? 'text-thermo' : 'text-dim'}`} />
        </div>
        {thermals.length === 0 ? (
          <div className="py-2 text-[11.5px] text-dim">
            Локальных тепловых максимумов не зафиксировано.
          </div>
        ) : (
          <div className="space-y-1.5">
            {thermals.map((d) => (
              <div
                key={`t-${d.id}`}
                className="slide-in-up flex items-center gap-2.5 rounded-[5px] border border-thermo/30 bg-thermo/8 px-2.5 py-2"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-thermo led-blink" />
                <span className="font-mono text-[15px] font-bold text-thermo tabular-nums">
                  ≈{d.thermal!.tempC}°C
                </span>
                <span className="ml-auto font-mono text-[9.5px] text-dim">
                  ({Math.round(d.thermal!.x)}; {Math.round(d.thermal!.y)}) · {d.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* метрики */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { k: 'АНАЛИЗ', v: `${engine.stats.lastMs || '—'}`, u: 'мс' },
          { k: 'СЕГМЕНТОВ', v: `${engine.stats.segments}`, u: '' },
          { k: 'КАДР', v: `${engine.stats.fps}`, u: 'к/с' },
          { k: 'T-МАКС', v: `${engine.stats.peakTemp}`, u: '°C' },
        ].map((m) => (
          <div key={m.k} className="panel px-2 py-2 text-center">
            <div className="hud-label text-[8.5px]!">{m.k}</div>
            <div className="font-mono text-[14px] font-bold text-fg tabular-nums">
              {m.v}
              <span className="text-[9px] font-medium text-dim"> {m.u}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
