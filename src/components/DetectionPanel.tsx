import { useEffect, useRef } from 'react';
import type { Engine } from '../lib/engine';
import type { OverlaySettings, SystemStatus } from '../lib/types';
import {
  IconBoxFrame,
  IconDoc,
  IconGrid,
  IconHeat,
  IconPulse,
  IconSnapshot,
  IconThermo,
} from './icons';

const TOGGLES: Array<{
  key: keyof OverlaySettings;
  label: string;
  Icon: (p: { className?: string }) => React.ReactElement;
}> = [
  { key: 'boxes', label: 'Рамки', Icon: IconBoxFrame },
  { key: 'heat', label: 'Тепло', Icon: IconHeat },
  { key: 'grid', label: 'Сетка', Icon: IconGrid },
  { key: 'thermal', label: 'Термометки', Icon: IconThermo },
];

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
  // разворачиваем все термоточки всех аномалий в плоский список
  const thermals = dets.flatMap((d) =>
    (d.thermals ?? (d.thermal ? [d.thermal] : [])).map((t, i) => ({
      ...t,
      key: `${d.id}-${i}`,
      label: d.label,
      hottest: i === 0,
    })),
  );
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

      {/* метрики — над термоточками */}
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

      {/* термоточки */}
      <div className="panel p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="hud-label">Термоточки</div>
          <IconThermo className={`h-4 w-4 ${thermals.length ? 'text-thermo' : 'text-dim'}`} />
        </div>
        {thermals.length === 0 ? (
          <div className="py-1.5 text-[11.5px] text-dim">Локальных тепловых максимумов не зафиксировано.</div>
        ) : (
          <div className="max-h-[150px] space-y-1.5 overflow-y-auto pr-1">
            {thermals.map((d) => (
              <div
                key={d.key}
                className={`slide-in-up flex items-center gap-2.5 rounded-[5px] border px-2.5 py-1.5 ${
                  d.hottest ? 'border-thermo/40 bg-thermo/10' : 'border-thermo/20 bg-thermo/5'
                }`}
              >
                <span
                  className={`shrink-0 rounded-full bg-thermo ${d.hottest ? 'h-2 w-2 led-blink' : 'h-1.5 w-1.5 opacity-70'}`}
                />
                <span
                  className={`font-mono font-bold text-thermo tabular-nums ${d.hottest ? 'text-[15px]' : 'text-[12.5px]'}`}
                >
                  ≈{d.tempC}°C
                </span>
                {d.hottest && (
                  <span className="rounded-[3px] bg-thermo/15 px-1 py-px font-mono text-[8px] font-bold tracking-wider text-thermo">
                    МАКС
                  </span>
                )}
                <span className="ml-auto text-right font-mono text-[9.5px] text-dim">
                  ({Math.round(d.x)}; {Math.round(d.y)}) · {d.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* журнал — посередине */}
      <div className="panel flex flex-col p-3.5">
        <div className="mb-1 flex items-center justify-between">
          <div className="hud-label">Журнал</div>
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
            <span className="font-mono text-[9px] text-dim">
              буфер −{fmtElapsed(Math.max(0, engine.historyLen / 5))}
            </span>
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
            <span className="font-mono text-[9px] text-dim">
              кадр {Math.max(0, scrub)}/{maxScrub}
            </span>
          </div>
        </div>

        {/* записи */}
        <div className="mb-1.5 flex items-baseline justify-between">
          <div className="hud-label">Записи · {engine.journal.length}</div>
          <span className="font-mono text-[9px] text-dim">в окне — последние 10</span>
        </div>
        <div
          ref={journalRef}
          onScroll={(e) => {
            stickTop.current = (e.target as HTMLDivElement).scrollTop < 30;
          }}
          className="max-h-[300px] space-y-1 overflow-y-auto pr-1"
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

      {/* параметры конвейера — перенесены из нижней панели */}
      <div className="panel p-3.5">
        <div className="hud-label mb-3">Параметры конвейера</div>

        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="thr" className="text-[11.5px] font-medium text-mut">
            Порог различий Δ
          </label>
          <span className="font-mono text-[11px] font-bold text-teal tabular-nums">
            {engine.threshold}
          </span>
        </div>
        <input
          id="thr"
          type="range"
          min={6}
          max={80}
          value={engine.threshold}
          onChange={(e) => engine.setThreshold(Number(e.target.value))}
        />
        <div className="mb-3 flex justify-between font-mono text-[9px] text-dim">
          <span>чувствительнее</span>
          <span>строже</span>
        </div>

        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="area" className="text-[11.5px] font-medium text-mut">
            Минимальная область
          </label>
          <span className="font-mono text-[11px] font-bold text-teal tabular-nums">
            {engine.minArea} px
          </span>
        </div>
        <input
          id="area"
          type="range"
          min={8}
          max={240}
          value={engine.minArea}
          onChange={(e) => engine.setMinArea(Number(e.target.value))}
        />
        <div className="mb-3 flex justify-between font-mono text-[9px] text-dim">
          <span>мелкие очаги</span>
          <span>крупные зоны</span>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {TOGGLES.map(({ key, label, Icon }) => {
            const on = engine.overlays[key];
            return (
              <button
                key={key}
                onClick={() => engine.toggleOverlay(key)}
                className={`flex flex-col items-center gap-1 rounded-[5px] border px-1 py-1.5 text-[9.5px] font-semibold transition-all duration-150 ${
                  on
                    ? 'border-teal/50 bg-teal/10 text-teal'
                    : 'border-line bg-panel2 text-dim hover:border-line2 hover:text-mut'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={engine.snapshot}
            className="flex items-center justify-center gap-1.5 rounded-[5px] border border-line bg-panel2 px-2 py-2 text-[11.5px] font-semibold text-mut transition-colors hover:border-teal/50 hover:bg-teal/10 hover:text-teal"
          >
            <IconSnapshot className="h-3.5 w-3.5" /> Снимок обстановки
          </button>
          <button
            onClick={engine.exportReport}
            className="flex items-center justify-center gap-1.5 rounded-[5px] border border-line bg-panel2 px-2 py-2 text-[11.5px] font-semibold text-mut transition-colors hover:border-teal/50 hover:bg-teal/10 hover:text-teal"
          >
            <IconDoc className="h-3.5 w-3.5" /> Отчёт JSON
          </button>
        </div>
      </div>
    </div>
  );
}
