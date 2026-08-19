import { useEffect, useRef } from 'react';
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

const STATUS_DOT: Record<SystemStatus, string> = {
  norm: '#48c96f',
  warn: '#f2a72e',
  alert: '#f07233',
  critical: '#f4483c',
};

function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function DetectionPanel({ engine }: { engine: Engine }) {
  const dets = engine.display?.dets ?? engine.detections;
  const status = engine.display?.status ?? engine.status;
  const peakTemp = engine.display?.peakTemp ?? engine.stats.peakTemp;
  const st = STATUS_WORD[status];
  const thermals = dets.filter((d) => d.thermal);
  const strong = dets.filter((d) => d.confidence >= 0.5);

  const scrub = engine.following ? engine.historyLen - 1 : engine.scrubIndex;
  const maxScrub = Math.max(0, engine.historyLen - 1);
  const shownElapsed = engine.display?.elapsed ?? 0;
  const activeEntryId = engine.following
    ? engine.journal[0]?.id
    : engine.journal.find((e) => e.histIdx === engine.scrubIndex)?.id;

  // журнал: окно на последние 10 записей, прокрутка к предыдущим,
  // автоследование за свежими записями, пока оператор у верха ленты
  const journalRef = useRef<HTMLDivElement>(null);
  const stickTop = useRef(true);
  useEffect(() => {
    if (stickTop.current && journalRef.current) journalRef.current.scrollTop = 0;
  }, [engine.journal.length]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* статус */}
      <div className="panel relative overflow-hidden p-4">
        <div
          className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl ${
            status === 'critical'
              ? 'bg-crit/20'
              : status === 'alert'
                ? 'bg-alert/15'
                : status === 'warn'
                  ? 'bg-warn/10'
                  : 'bg-okc/10'
          }`}
        />
        <div className="flex items-start justify-between">
          <div>
            <div className="hud-label">Статус сцены</div>
            <div className={`font-display text-[26px] font-bold leading-tight ${st.cls}`}>{st.word}</div>
            <div className="mt-0.5 text-[11.5px] text-mut">{st.note}</div>
          </div>
          {engine.following ? (
            <span className="flex items-center gap-1.5 rounded-[4px] border border-crit/50 bg-crit/10 px-2 py-1 font-mono text-[9.5px] font-bold tracking-widest text-crit">
              <span className="h-1.5 w-1.5 rounded-full bg-crit led-blink" /> LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-[4px] border border-thermo/50 bg-thermo/10 px-2 py-1 font-mono text-[9.5px] font-bold tracking-widest text-thermo">
              ⟲ ПЕРЕМОТКА
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 font-mono text-[10.5px] text-dim">
          <IconPulse className="h-3.5 w-3.5 text-teal" />
          объектов: {strong.length} · анализ каждые 200 мс
        </div>
      </div>

      {/* классификация: журнал с перемоткой */}
      <div className="panel flex flex-col p-3.5">
        <div className="mb-1 flex items-center justify-between">
          <div className="hud-label">Классификация аномалий</div>
          <span className="font-mono text-[9.5px] text-dim tabular-nums">
            {engine.following ? 'LIVE' : `t+${fmtElapsed(shownElapsed)}`} · {engine.display?.clock ?? '—:—:—'}
          </span>
        </div>

        {/* лента времени */}
        <div className="mb-2 rounded-[5px] border border-line bg-panel2 px-2.5 py-2">
          <input
            type="range"
            min={0}
            max={maxScrub}
            value={Math.max(0, Math.min(scrub, maxScrub))}
            onChange={(e) => engine.seek(Number(e.target.value))}
            aria-label="Перемотка журнала классификаций"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-[9px] text-dim">буфер −{fmtElapsed(Math.max(0, engine.historyLen / 5))}</span>
            <button
              onClick={engine.followLive}
              className={`rounded-[4px] px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-widest transition-colors ${
                engine.following
                  ? 'bg-crit/20 text-crit'
                  : 'border border-teal/50 bg-teal/10 text-teal hover:bg-teal/20'
              }`}
            >
              {engine.following ? '● В ЭФИРЕ' : '▶ К ЭФИРУ'}
            </button>
            <span className="font-mono text-[9px] text-dim">кадр {Math.max(0, scrub)}/{maxScrub}</span>
          </div>
        </div>

        {/* текущий (выбранный) момент */}
        {dets.length > 0 ? (
          <div className="mb-2 space-y-1.5">
            {dets.slice(0, 4).map((d) => {
              const Icon = KLASS_ICON[d.klass];
              const meta = KLASS_META[d.klass];
              return (
                <div
                  key={d.id}
                  className="rounded-[5px] border border-line bg-panel2 px-2.5 py-1.5"
                  style={{ borderLeft: `3px solid ${meta.color}` }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-fg">{d.label}</span>
                    {d.thermal && (
                      <span className="font-mono text-[10px] font-bold text-thermo">≈{d.thermal.tempC}°C</span>
                    )}
                    <span
                      className="rounded-[3px] px-1.5 py-0.5 font-mono text-[9.5px] font-bold"
                      style={{ color: meta.color, background: `${meta.color}1f` }}
                    >
                      {Math.round(d.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.round(d.confidence * 100)}%`, background: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mb-2 flex items-center gap-2 rounded-[5px] border border-line bg-panel2 px-2.5 py-2">
            <IconCheck className="h-4 w-4 shrink-0 text-okc/70" />
            <span className="text-[11.5px] text-dim">
              Расхождений с эталоном выше порога нет — сцена стабильна.
            </span>
          </div>
        )}

        {/* журнал */}
        <div className="mb-1.5 mt-1 flex items-baseline justify-between">
          <div className="hud-label">Журнал · {engine.journal.length}</div>
          <span className="font-mono text-[9px] text-dim">в окне — последние 10</span>
        </div>
        <div
          ref={journalRef}
          onScroll={(e) => {
            stickTop.current = (e.target as HTMLDivElement).scrollTop < 30;
          }}
          className="max-h-[336px] space-y-1 overflow-y-auto pr-1"
        >
          {engine.journal.length === 0 && (
            <div className="py-4 text-center font-mono text-[10px] text-dim">
              записей пока нет — события появятся здесь
            </div>
          )}
          {engine.journal.map((e) => {
            const active = e.id === activeEntryId;
            return (
              <button
                key={e.id}
                onClick={() => engine.seek(e.histIdx)}
                className={`slide-in-r flex w-full items-center gap-2 rounded-[4px] border px-2 py-1.5 text-left transition-colors ${
                  active
                    ? 'border-teal/50 bg-teal/10'
                    : 'border-transparent hover:border-line hover:bg-panel2'
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: STATUS_DOT[e.status] }}
                />
                <span className="w-[52px] shrink-0 font-mono text-[9.5px] text-dim tabular-nums">
                  {fmtElapsed(e.elapsed)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-fg">
                  {e.topLabel}
                  {e.count > 1 && <span className="text-dim"> +{e.count - 1}</span>}
                </span>
                <span className="shrink-0 font-mono text-[9.5px] text-thermo">
                  {e.peakTemp > 40 ? `${e.peakTemp}°` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* термоточки */}
      <div className="panel p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="hud-label">Термоточки</div>
          <IconThermo className={`h-4 w-4 ${thermals.length ? 'text-thermo' : 'text-dim'}`} />
        </div>
        {thermals.length === 0 ? (
          <div className="py-1.5 text-[11.5px] text-dim">Локальных тепловых максимумов не зафиксировано.</div>
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
          { k: 'T-МАКС', v: `${peakTemp}`, u: '°C' },
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
