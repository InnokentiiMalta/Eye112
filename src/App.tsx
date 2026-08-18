import BottomDock from './components/BottomDock';
import DetectionPanel from './components/DetectionPanel';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Viewport from './components/Viewport';
import { useEngine } from './lib/engine';
import { CAMERAS } from './lib/scenes';
import { SCENARIOS } from './lib/scenarios';

export default function App() {
  const engine = useEngine();
  const cam = CAMERAS.find((c) => c.id === engine.cameraId);
  const scn = SCENARIOS.find((s) => s.id === engine.scenario);

  return (
    <div className="min-h-screen font-sans text-fg">
      <TopBar
        status={engine.status}
        cameraName={cam?.name ?? '—'}
        scenarioTitle={scn?.title ?? '—'}
        ready={engine.ready}
      />

      <main className="mx-auto grid max-w-[1720px] gap-3 p-3 lg:grid-cols-[290px_minmax(0,1fr)_375px] lg:p-4">
        <div className="order-3 lg:order-none">
          <Sidebar engine={engine} />
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
          ПУЛЬСАР·М · демонстрационный стенд: тестовые сцены синтезируются в реальном времени,
          анализ выполняется попиксельно локально (разность с эталоном → пороговая фильтрация →
          сегментация → спектральная классификация). Можно загрузить эталон и видео с того же
          ракурса — расхождения классифицируются по ходу воспроизведения; журнал классификаций
          поддерживает перемотку. Для сетевого видеопотока подключите RTSP-источник к серверу обработки.
        </p>
      </footer>
    </div>
  );
}
