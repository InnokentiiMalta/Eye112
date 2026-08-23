import { useRef, useState } from 'react';
import type { Engine } from '../lib/engine';
import { KLASS_META, SEVERITY_META } from '../lib/types';

export default function BottomDock({ engine }: { engine: Engine }) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(44);
  const [height, setHeight] = useState(320);
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
      setHeight(Math.min(620, Math.max(200, h)));
    }
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  // только АКТИВНЫЕ аномалии (достоверность >= 50 %)
  const active = (engine.display?.dets ?? engine.detections).filter(
    (d) => d.confidence >= 0.5,
  );

  return (
    <div ref={dockRef} className="relative" onPointerMove={onMove} onPointerUp={endDrag}>
      <div className="flex w-full overflow-hidden" style={{ height }}>
        {/* классификация аномалий — журнальный формат */}
        <div
          className="panel flex h-full min-w-0 flex-col overflow-hidden"
          style={{ width: `${leftPct}%` }}
        >
          <div className="flex items-center justify-between px-3.5 pt-3">
            <div className="hud-label">Классификация аномалий</div>
            <span className="font-mono text-[9.5px] text-dim">
              активных:{' '}
              <span className={active.length ? 'font-bold text-crit' : 'text-okc'}>
                {active.length}
              </span>
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3.5 pb-3 pt-2">
            {active.length === 0 && (
              <div className="py-6 text-center font-mono text-[10.5px] text-dim">
                активных аномалий нет
              </div>
            )}
            {active.map((d) => {
              const meta = KLASS_META[d.klass];
              const hottest = d.thermals?.[0];
              return (
                <div
                  key={d.id}
                  title={`${d.label} · достоверность ${Math.round(d.confidence * 100)}% · ${
                    d.area
                  } px ≈ ${d.areaM2} м² · ср.Δ ${d.meanDiff} · центр (${Math.round(
                    d.centroid.x,
                  )}; ${Math.round(d.centroid.y)})`}
                  className="slide-in-r flex items-center gap-2 rounded-[4px] border border-transparent px-2 py-1 transition-colors hover:border-line hover:bg-panel2"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: meta.color }}
                  />
                  {d.time && (
                    <span className="shrink-0 font-mono text-[10px] text-dim tabular-nums">
                      {d.time}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium leading-snug text-fg">
                    {d.label}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[10px] font-bold tabular-nums"
                    style={{ color: meta.color }}
                  >
                    {Math.round(d.confidence * 100)}%
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-dim tabular-nums">
                    {d.areaM2} м²
                  </span>
                  {hottest && (
                    <span className="shrink-0 font-mono text-[10px] font-bold text-thermo tabular-nums">
                      ≈{hottest.tempC}°
                    </span>
                  )}
                </div>
              );
            })}
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
                  <span
                    className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: sev.color }}
                  />
                  <span className="shrink-0 font-mono text-[10px] text-dim tabular-nums">
                    {ev.time}
                  </span>
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
