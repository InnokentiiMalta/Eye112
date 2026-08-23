import { useEffect, useState } from 'react';
import BottomDock from './components/BottomDock';
import ChannelModal from './components/ChannelModal';
import DetectionPanel from './components/DetectionPanel';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Viewport from './components/Viewport';
import { IconDoc, IconDownload, IconSnapshot } from './components/icons';
import type { Engine } from './lib/engine';
import { useEngine } from './lib/engine';
import { CAMERAS } from './lib/scenes';
import { SCENARIOS } from './lib/scenarios';

/** Окно предпросмотра сформированного файла (PNG / JSON) с кнопками скачивания. */
function ArtifactModal({ engine }: { engine: Engine }) {
  const art = engine.artifact;
  useEffect(() => {
    if (!art) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') engine.clearArtifact();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [art, engine]);

  if (!art) return null;
  const isPng = art.kind === 'png';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-4 backdrop-blur-sm"
      onClick={engine.clearArtifact}
    >
      <div
        className="slide-in-up flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[8px] border border-line2 bg-panel shadow-[0_0_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          {isPng ? (
            <IconSnapshot className="h-4.5 w-4.5 text-teal" />
          ) : (
            <IconDoc className="h-4.5 w-4.5 text-teal" />
          )}
          <span className="font-mono text-[12px] font-bold text-fg">{art.name}</span>
          <span className="rounded-[3px] bg-teal/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-teal">
            {isPng ? 'Снимок PNG' : 'Отчёт JSON'}
          </span>
          <span className="ml-auto font-mono text-[9.5px] text-dim">
            Esc — закрыть
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-abyss/60 p-4">
          {isPng ? (
            <img
              src={art.url}
              alt={art.name}
              className="mx-auto max-h-[62vh] w-auto max-w-full rounded-[4px] border border-line"
            />
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-mut">
              {art.text}
            </pre>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <a
            href={art.url}
            download={art.name}
            className="flex items-center gap-1.5 rounded-[5px] border border-teal/60 bg-teal/15 px-3.5 py-2 text-[11.5px] font-bold text-teal transition-colors hover:bg-teal/25"
          >
            <IconDownload className="h-3.5 w-3.5" /> Скачать на устройство
          </a>
          <a
            href={art.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[5px] border border-line bg-panel2 px-3.5 py-2 text-[11.5px] font-semibold text-mut transition-colors hover:border-line2 hover:text-fg"
          >
            Открыть в новой вкладке
          </a>
          <button
            onClick={engine.clearArtifact}
            className="ml-auto rounded-[5px] border border-line bg-panel2 px-3.5 py-2 text-[11.5px] font-semibold text-mut transition-colors hover:border-line2 hover:text-fg"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

/** Всплывающие уведомления о результатах действий. */
function ToastStack({ engine }: { engine: Engine }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[340px] flex-col gap-2">
      {engine.toasts.map((t) => (
        <div
          key={t.id}
          className={`slide-in-r flex items-center gap-2.5 rounded-[6px] border px-3 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.5)] backdrop-blur ${
            t.kind === 'ok'
              ? 'border-teal/50 bg-[#0d1a1c]/95 text-teal'
              : 'border-crit/50 bg-[#1c0d0d]/95 text-crit'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.kind === 'ok' ? 'bg-teal' : 'bg-crit'}`}
          />
          <span className="font-mono text-[10.5px] leading-snug">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const engine = useEngine();
  const cam = CAMERAS.find((c) => c.id === engine.cameraId);
  const scn = SCENARIOS.find((s) => s.id === engine.scenario);
  const [channelOpen, setChannelOpen] = useState(false);

  return (
    <div className="min-h-screen font-sans text-fg">
      <TopBar
        status={engine.status}
        cameraName={cam?.name ?? '—'}
        scenarioTitle={
          engine.speed !== 1 ? `${scn?.title ?? '—'} · ×${engine.speed}` : scn?.title ?? '—'
        }
        ready={engine.ready}
      />

      <main className="mx-auto grid max-w-[1720px] gap-3 p-3 lg:grid-cols-[290px_minmax(0,1fr)_375px] lg:p-4">
        <div className="order-3 lg:order-none">
          <Sidebar engine={engine} onOpenChannel={() => setChannelOpen(true)} />
        </div>

        <section className="order-1 flex min-w-0 flex-col gap-3 lg:order-none">
          <Viewport engine={engine} />
          <BottomDock engine={engine} />
        </section>

        <div className="order-2 lg:order-none">
          <DetectionPanel engine={engine} />
        </div>
      </main>

      <footer className="mx-auto max-w-[1660px] px-3 pb-4 lg:px-4">
        <p className="border-t border-line pt-3 font-mono text-[9.5px] leading-relaxed text-dim">
          ОКО · демонстрационный стенд: тестовые сцены синтезируются в реальном времени,
          анализ выполняется попиксельно локально (разность с эталоном → пороговая фильтрация →
          сегментация → спектральная классификация). Можно загрузить эталон и видео с того же
          ракурса — расхождения классифицируются по ходу воспроизведения; журнал классификаций
          поддерживает перемотку. Для сетевого видеопотока подключите RTSP-источник к серверу обработки.
        </p>
      </footer>

      <ArtifactModal engine={engine} />
      <ToastStack engine={engine} />
      {channelOpen && <ChannelModal engine={engine} onClose={() => setChannelOpen(false)} />}
    </div>
  );
}
