import { useEffect, useState } from 'react';
import type { SystemStatus } from '../lib/types';
import { IconEye } from './icons';

const STATUS_CHIP: Record<SystemStatus, { text: string; cls: string }> = {
  norm: { text: 'ШТАТНО', cls: 'text-okc border-okc/40 bg-okc/10' },
  warn: { text: 'ВНИМАНИЕ', cls: 'text-warn border-warn/40 bg-warn/10' },
  alert: { text: 'УГРОЗА', cls: 'text-alert border-alert/50 bg-alert/10' },
  critical: { text: 'ТРЕВОГА', cls: 'text-crit border-crit/60 bg-crit/15 led-blink' },
};

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right leading-tight">
      <div className="font-mono text-sm font-medium text-fg tabular-nums">
        {now.toTimeString().slice(0, 8)}
      </div>
      <div className="font-mono text-[10px] text-dim tabular-nums">
        {now.toLocaleDateString('ru-RU')} · МСК
      </div>
    </div>
  );
}

interface Props {
  status: SystemStatus;
  cameraName: string;
  scenarioTitle: string;
  ready: boolean;
  channelActive: boolean;
  onOpenChannel: () => void;
}

export default function TopBar({ status, cameraName, scenarioTitle, ready, channelActive, onOpenChannel }: Props) {
  const chip = STATUS_CHIP[status];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-abyss/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1660px] items-center gap-4 px-3 lg:px-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[5px] border border-teal/40 bg-teal/10 text-teal shadow-[0_0_18px_rgba(47,214,195,0.25)]">
            <IconEye className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[16px] font-bold tracking-[0.22em] text-fg">
              ОК<span className="text-teal">О</span>
            </div>
            <div className="hud-label">комплекс видеоаналитики ЧС · v3.0</div>
          </div>
        </div>

        <div className="ml-2 hidden items-center gap-2 md:flex">
          <span className="rounded-[4px] border border-line bg-panel px-2.5 py-1 font-mono text-[11px] text-mut">
            {cameraName}
          </span>
          <span className="rounded-[4px] border border-line bg-panel px-2.5 py-1 font-mono text-[11px] text-mut">
            режим: <span className="text-fg">{scenarioTitle.toLowerCase()}</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden font-mono text-[10px] tracking-[0.18em] text-dim sm:block">
            {ready ? 'ОБРАБОТКА: ЛОКАЛЬНО · 5 ГЦ' : 'ИНИЦИАЛИЗАЦИЯ…'}
          </span>
          <button
            onClick={onOpenChannel}
            className={`flex items-center gap-2 rounded-[4px] border px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.1em] transition-all ${
              channelActive
                ? 'border-teal/60 bg-teal/15 text-teal shadow-[0_0_14px_rgba(47,214,195,0.25)]'
                : 'border-line bg-panel text-mut hover:border-teal/50 hover:text-teal'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${channelActive ? 'bg-teal led-blink' : 'bg-dim'}`} />
            КАНАЛ
          </button>
          <span
            className={`rounded-[4px] border px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.14em] ${chip.cls}`}
          >
            {chip.text}
          </span>
          <Clock />
        </div>
      </div>
    </header>
  );
}
