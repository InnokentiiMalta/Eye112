import { useEffect, useRef, useState } from 'react';
import type { Engine } from '../lib/engine';
import { VIEW_H, VIEW_W } from '../lib/engine';
import { AW, AH } from '../lib/pipeline';
import { CAMERAS } from '../lib/scenes';
import type { ViewMode } from '../lib/types';
import { IconAlert, IconBoxFrame, IconCompare, IconEye, IconHeat, IconRadar } from './icons';

const MODES: Array<{ id: ViewMode; label: string; Icon: (p: { className?: string }) => React.ReactElement }> = [
  { id: 'live', label: 'Наблюдение', Icon: IconEye },
  { id: 'reference', label: 'Эталон', Icon: IconBoxFrame },
  { id: 'compare', label: 'Сравнение', Icon: IconCompare },
  { id: 'thermal', label: 'Тепловизор', Icon: IconHeat },
];

function HudClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{now.toTimeString().slice(0, 8)}</span>;
}

export default function Viewport({ engine }: { engine: Engine }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const cam = CAMERAS.find((c) => c.id === engine.cameraId);
  const mode = engine.viewMode;

  const setPos = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    engine.setComparePos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  const topDet = engine.detections[0];
  const showBanner = (engine.status === 'critical' || engine.status === 'alert') && topDet;
  const tempColor =
    engine.stats.peakTemp > 110 ? 'text-crit' : engine.stats.peakTemp > 55 ? 'text-warn' : 'text-teal';

  const corner = 'pointer-events-none absolute h-5 w-5 border-teal/50';

  return (
    <div className="panel overflow-hidden">
      {/* панель режимов */}
      <div className="flex items-center gap-1 border-b border-line px-2.5 py-1.5">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => engine.setViewMode(id)}
            className={`flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
              mode === id
                ? 'bg-teal/15 text-teal shadow-[inset_0_0_0_1px_rgba(47,214,195,0.4)]'
                : 'text-mut hover:bg-panel3 hover:text-fg'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 font-mono text-[10px] text-dim">
          <span className="h-2 w-2 rounded-full bg-crit led-blink" />
          REC · {cam?.short ?? '—'}
        </div>
      </div>

      {/* видеообласть */}
      <div
        ref={wrapRef}
        className="relative aspect-video touch-none select-none overflow-hidden bg-abyss"
        onPointerDown={(e) => {
          if (mode !== 'compare') return;
          dragging.current = true;
          setPos(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) setPos(e.clientX);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        <canvas
          ref={engine.bindRef}
          width={VIEW_W}
          height={VIEW_H}
          className={`absolute inset-0 h-full w-full ${
            mode === 'reference' || mode === 'compare' ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <canvas
          ref={engine.bindLive}
          width={VIEW_W}
          height={VIEW_H}
          className={`absolute inset-0 h-full w-full transition-[opacity,filter] duration-300 ${
            mode === 'reference' ? 'opacity-0' : mode === 'thermal' ? 'opacity-35 grayscale' : 'opacity-100'
          }`}
          style={mode === 'compare' ? { clipPath: `inset(0 0 0 ${engine.comparePos}%)` } : undefined}
        />
        <canvas
          ref={engine.bindHeat}
          width={AW}
          height={AH}
          className={`pointer-events-none absolute inset-0 h-full w-full mix-blend-screen blur-[2.5px] transition-opacity duration-300 ${
            mode === 'thermal' ? 'opacity-100' : mode === 'live' && engine.overlays.heat ? 'opacity-75' : 'opacity-0'
          }`}
        />
        <canvas
          ref={engine.bindOverlay}
          width={VIEW_W}
          height={VIEW_H}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {/* сканирующая линия */}
        {(mode === 'live' || mode === 'thermal') && (
          <div className="scanline pointer-events-none absolute inset-x-0 h-14 bg-gradient-to-b from-transparent via-teal/8 to-transparent" />
        )}

        {/* угловые метки */}
        <div className={`${corner} left-2 top-2 border-l-2 border-t-2`} />
        <div className={`${corner} right-2 top-2 border-r-2 border-t-2`} />
        <div className={`${corner} bottom-2 left-2 border-b-2 border-l-2`} />
        <div className={`${corner} bottom-2 right-2 border-b-2 border-r-2`} />

        {/* HUD */}
        <div className="pointer-events-none absolute left-4 top-3 font-mono text-[10.5px] tracking-[0.12em] text-teal/90">
          {cam?.name.toUpperCase()}
        </div>
        <div className="pointer-events-none absolute right-4 top-3 text-right font-mono text-[10.5px]">
          <span className="text-dim">T-МАКС </span>
          <span className={`font-bold tabular-nums ${tempColor}`}>{engine.stats.peakTemp}°C</span>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10.5px] text-mut">
          <span className="text-crit">●</span> REC · <HudClock /> · 25 FPS
        </div>
        <div className="pointer-events-none absolute bottom-3 right-4 font-mono text-[10.5px] text-dim">
          1280×720 · АНАЛИЗ 320×180 · Δ-ПОРОГ {engine.threshold}
        </div>

        {/* баннер тревоги */}
        {showBanner && topDet && (
          <div
            className={`absolute left-1/2 top-10 flex -translate-x-1/2 items-center gap-2.5 rounded-[5px] px-4 py-2 ${
              engine.status === 'critical' ? 'alert-flash bg-crit/15 text-crit' : 'bg-alert/15 text-alert'
            }`}
          >
            <IconAlert className="h-4.5 w-4.5 shrink-0" />
            <span className="whitespace-nowrap font-mono text-[12px] font-bold tracking-[0.1em]">
              {engine.status === 'critical' ? 'ТРЕВОГА' : 'УГРОЗА'} · {topDet.label.toUpperCase()} ·{' '}
              {Math.round(topDet.confidence * 100)}%
            </span>
          </div>
        )}

        {/* разделитель сравнения */}
        {mode === 'compare' && (
          <>
            <div
              className="absolute inset-y-0 z-10 w-[2px] bg-teal shadow-[0_0_12px_rgba(47,214,195,0.7)]"
              style={{ left: `${engine.comparePos}%` }}
            >
              <div className="absolute top-1/2 left-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-teal bg-abyss text-teal">
                <IconCompare className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 rounded-[4px] bg-abyss/80 px-2 py-1 font-mono text-[10px] tracking-[0.16em] text-mut">
              ЭТАЛОН
            </div>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-[4px] bg-abyss/80 px-2 py-1 font-mono text-[10px] tracking-[0.16em] text-teal">
              ТЕКУЩИЙ КАДР
            </div>
          </>
        )}

        {/* инициализация */}
        {!engine.ready && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-abyss/90">
            <div className="flex flex-col items-center gap-3">
              <IconRadar className="h-9 w-9 animate-spin text-teal [animation-duration:2.4s]" />
              <div className="font-mono text-[11px] tracking-[0.2em] text-mut">
                ЗАГРУЗКА ЭТАЛОННЫХ КАДРОВ…
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
