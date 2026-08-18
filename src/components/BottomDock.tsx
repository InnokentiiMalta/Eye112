import { useRef, useState } from 'react';
import type { Engine } from '../lib/engine';
import type { OverlaySettings } from '../lib/types';
import { SEVERITY_META } from '../lib/types';
import {
  IconBoxFrame,
  IconDoc,
  IconGrid,
  IconHeat,
  IconSnapshot,
  IconThermo,
} from './icons';

const TOGGLES: Array<{ key: keyof OverlaySettings; label: string; Icon: (p: { className?: string }) => React.ReactElement }> = [
  { key: 'boxes', label: 'Рамки', Icon: IconBoxFrame },
  { key: 'heat', label: 'Тепло', Icon: IconHeat },
  { key: 'grid', label: 'Сетка', Icon: IconGrid },
  { key: 'thermal', label: 'Термометки', Icon: IconThermo },
];

export default function BottomDock({ engine }: { engine: Engine }) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(38);
  const [height, setHeight] = useState(250);
  const dragRef = useRef<'w' | 'h' | null>(null);

  const startWidth = (e: React.PointerEvent) => {
    dragRef.current = 'w';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const startHeight = (e: React.PointerEvent) => {
    dragRef.current = 'h';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !dockRef.current) return;
    const r = dockRef.current.getBoundingClientRect();
    if (dragRef.current === 'w') {
      const pct = ((e.clientX - r.left) / r.width) * 100;
      setLeftPct(Math.min(68, Math.max(22, pct)));
    } else {
      const h = e.clientY - r.top;
      setHeight(Math.min(460, Math.max(180, h)));
    }
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="relative">
      <div
        ref={dockRef}
        className="flex w-full overflow-hidden"
        style={{ height }}
        onPointerMove={onMove}
        onPointerUp={endDrag}
      >
        {/* параметры конвейера */}
        <div className="panel flex h-full min-w-0 flex-col overflow-hidden" style={{ width: `${leftPct}%` }}>
          <div className="flex-1 overflow-y-auto p-3.5">
            <div className="hud-label mb-3">Параметры конвейера</div>

            <div className="mb-1 flex items-baseline justify-between">
              <label htmlFor="thr" className="text-[11.5px] font-medium text-mut">
                Порог различий Δ
              </label>
              <span className="font-mono text-[11px] font-bold text-teal tabular-nums">{engine.threshold}</span>
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
              <span className="font-mono text-[11px] font-bold text-teal tabular-nums">{engine.minArea} px</span>
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
                <IconSnapshot className="h-3.5 w-3.5" /> Снимок PNG
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

        {/* вертикальная ручка изменения ширины */}
        <div
          onPointerDown={startWidth}
          className="group flex w-[9px] shrink-0 cursor-col-resize items-center justify-center"
          title="Потяните, чтобы изменить ширину"
        >
          <div className="h-full w-[3px] rounded-full bg-line transition-colors group-hover:bg-teal/60" />
        </div>

        {/* журнал событий */}
        <div className="panel flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3.5 pt-3">
            <div className="hud-label">Журнал событий</div>
            <span className="font-mono text-[9.5px] text-dim">записей: {engine.events.length}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3.5 pb-3 pt-2">
            {engine.events.length === 0 && (
              <div className="py-6 text-center font-mono text-[10.5px] text-dim">журнал пуст</div>
            )}
            {engine.events.map((ev) => {
              const sev = SEVERITY_META[ev.severity];
              return (
                <div
                  key={ev.id}
                  className="slide-in-r flex items-start gap-2 rounded-[4px] border border-transparent px-2 py-1 transition-colors hover:border-line hover:bg-panel2"
                >
                  <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sev.color }} />
                  <span className="shrink-0 font-mono text-[10px] text-dim tabular-nums">{ev.time}</span>
                  <span
                    className="min-w-0 flex-1 text-[11.5px] leading-snug"
                    style={{
                      color:
                        ev.severity === 'critical'
                          ? '#f4483c'
                          : ev.severity === 'alert'
                            ? '#f0a35e'
                            : '#c4cfdd',
                    }}
                  >
                    {ev.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* горизонтальная ручка изменения высоты */}
      <div
        onPointerDown={startHeight}
        className="group flex h-[11px] w-full cursor-row-resize items-center justify-center"
        title="Потяните, чтобы изменить высоту"
      >
        <div className="h-[3px] w-14 rounded-full bg-line transition-all group-hover:w-24 group-hover:bg-teal/60" />
      </div>
    </div>
  );
}
