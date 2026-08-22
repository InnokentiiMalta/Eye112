import { useEffect, useState } from 'react';
import type { Engine } from '../lib/engine';
import type { StreamKind } from '../lib/types';
import { IconCamera, IconEye, IconFolder, IconRadar, IconReset } from './icons';

type Tab = 'stream' | 'webcam' | 'folder';

const KINDS: Array<{ id: StreamKind; label: string; ph: string; hint: string }> = [
  {
    id: 'mjpeg',
    label: 'MJPEG',
    ph: 'http://192.168.1.50:8080/video',
    hint: 'multipart/x-mixed-replace — поддерживается браузером напрямую',
  },
  {
    id: 'hls',
    label: 'HLS',
    ph: 'http://host/live/cam1/index.m3u8',
    hint: 'плейлист .m3u8 — воспроизводится через hls.js',
  },
  {
    id: 'ws',
    label: 'WebSocket',
    ph: 'ws://host:8765',
    hint: 'сервер присылает бинарные JPEG-кадры (например, мост с RTSP)',
  },
];

const TABS: Array<{ id: Tab; label: string; Icon: (p: { className?: string }) => React.ReactElement }> = [
  { id: 'stream', label: 'Сетевой поток', Icon: IconRadar },
  { id: 'webcam', label: 'Локальная камера', Icon: IconCamera },
  { id: 'folder', label: 'Папка (спутник)', Icon: IconFolder },
];

export default function ChannelModal({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('stream');
  const [kind, setKind] = useState<StreamKind>('mjpeg');
  const [url, setUrl] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [pollSec, setPollSec] = useState(5);
  const [permAsked, setPermAsked] = useState(false);

  const activeKind = KINDS.find((k) => k.id === kind)!;
  const folderSupported = typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

  // список устройств (после запроса разрешения метки становятся читаемыми)
  const refreshDevices = async (askPerm: boolean) => {
    try {
      if (askPerm) {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach((t) => t.stop());
        setPermAsked(true);
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === 'videoinput'));
    } catch {
      /* доступ не выдан — список может быть без меток */
    }
  };
  useEffect(() => {
    if (tab === 'webcam') refreshDevices(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const connect = () => {
    if (tab === 'stream') {
      if (!url.trim()) return;
      engine.connectStream(kind, url.trim());
      onClose();
    } else if (tab === 'webcam') {
      const dev = devices.find((d) => d.deviceId === deviceId);
      engine.connectWebcam(deviceId, dev?.label || '');
      onClose();
    } else {
      engine.connectFolder(pollSec);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="panel slide-in-up w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* заголовок */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="font-display text-[13px] font-bold tracking-[0.08em] text-fg">
              ИСТОЧНИКИ ВИДЕОПОТОКА
            </div>
            <div className="hud-label mt-0.5">подключение внешнего канала к конвейеру анализа</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-[4px] border border-line px-2 py-1 font-mono text-[11px] text-mut transition-colors hover:border-crit/50 hover:text-crit"
          >
            ESC
          </button>
        </div>

        {/* активный канал */}
        {engine.channel.active && (
          <div className="flex items-center gap-2.5 border-b border-line bg-teal/6 px-4 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-teal led-blink" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[11px] font-bold text-teal">
                {engine.channel.type === 'stream'
                  ? engine.channel.kind?.toUpperCase()
                  : engine.channel.type === 'webcam'
                    ? 'WEBCAM'
                    : 'СПУТНИК'}{' '}
                · {engine.channel.label}
              </span>
              <span className="block truncate font-mono text-[9.5px] text-dim">{engine.channel.status}</span>
            </span>
            <button
              onClick={() => {
                engine.disconnectChannel();
                onClose();
              }}
              className="flex shrink-0 items-center gap-1 rounded-[4px] border border-crit/40 bg-crit/10 px-2 py-1 text-[10.5px] font-bold text-crit transition-colors hover:bg-crit/20"
            >
              <IconReset className="h-3 w-3" /> ОТКЛЮЧИТЬ
            </button>
          </div>
        )}

        {/* вкладки */}
        <div className="flex gap-1 border-b border-line px-3 pt-2.5">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-t-[5px] border border-b-0 px-3 py-2 text-[11.5px] font-semibold transition-colors ${
                tab === id
                  ? 'border-line bg-panel3 text-teal'
                  : 'border-transparent text-mut hover:text-fg'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="space-y-3 p-4">
          {/* -------- сетевой поток -------- */}
          {tab === 'stream' && (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setKind(k.id)}
                    className={`rounded-[5px] border px-2 py-2 font-mono text-[11px] font-bold transition-all ${
                      kind === k.id
                        ? 'border-teal/60 bg-teal/15 text-teal'
                        : 'border-line bg-panel2 text-mut hover:border-line2 hover:text-fg'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor="ch-url" className="hud-label mb-1 block">
                  Адрес потока
                </label>
                <input
                  id="ch-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={activeKind.ph}
                  className="w-full rounded-[5px] border border-line bg-abyss px-3 py-2 font-mono text-[12px] text-fg outline-none transition-colors focus:border-teal/60"
                />
                <p className="mt-1 text-[10px] leading-snug text-dim">{activeKind.hint}</p>
              </div>
              <p className="rounded-[4px] border border-warn/30 bg-warn/6 px-2.5 py-2 text-[10px] leading-snug text-warn/90">
                RTSP браузером напрямую не поддерживается. Подключите камеру через мост
                (mediamtx, go2rtc, RTSPtoWeb), отдающий HLS, MJPEG или WebSocket-кадры.
              </p>
            </>
          )}

          {/* -------- локальная камера -------- */}
          {tab === 'webcam' && (
            <>
              <div className="flex items-center justify-between">
                <label htmlFor="ch-dev" className="hud-label">
                  Видеоустройства
                </label>
                <button
                  onClick={() => refreshDevices(true)}
                  className="font-mono text-[10px] text-teal underline-offset-2 hover:underline"
                >
                  {permAsked ? 'обновить список' : 'запросить доступ и список'}
                </button>
              </div>
              {devices.length === 0 ? (
                <p className="rounded-[4px] border border-line bg-panel2 px-2.5 py-2 text-[10.5px] text-mut">
                  Устройства не найдены. Запросите доступ — и список камер появится. Можно
                  подключиться и без списка (системная камера по умолчанию).
                </p>
              ) : (
                <select
                  id="ch-dev"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="w-full rounded-[5px] border border-line bg-abyss px-3 py-2 font-mono text-[12px] text-fg outline-none focus:border-teal/60"
                >
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Камера ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[10px] leading-snug text-dim">
                Камера транслируется в вьюпорт в реальном времени; конвейер сравнивает каждый
                кадр с эталоном и классифицирует расхождения.
              </p>
            </>
          )}

          {/* -------- папка со скриншотами -------- */}
          {tab === 'folder' && (
            <>
              {!folderSupported ? (
                <p className="rounded-[4px] border border-crit/30 bg-crit/6 px-2.5 py-2 text-[10.5px] text-crit">
                  Этот браузер не поддерживает доступ к локальным папкам. Используйте Chromium
                  (Chrome / Edge) — и функция станет доступна.
                </p>
              ) : (
                <>
                  <p className="text-[10.5px] leading-relaxed text-mut">
                    Спутник присылает снимки в выбранную папку. Система опрашивает её и каждый
                    новый файл автоматически подставляет как текущий кадр для сравнения с
                    эталоном.
                  </p>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label htmlFor="ch-poll" className="hud-label mb-1 block">
                        Интервал опроса, с
                      </label>
                      <input
                        id="ch-poll"
                        type="number"
                        min={2}
                        max={120}
                        value={pollSec}
                        onChange={(e) => setPollSec(Number(e.target.value) || 5)}
                        className="w-full rounded-[5px] border border-line bg-abyss px-3 py-2 font-mono text-[12px] text-fg outline-none focus:border-teal/60"
                      />
                    </div>
                  </div>
                  {engine.folderInfo.connected && (
                    <div className="rounded-[5px] border border-line bg-panel2 px-3 py-2 font-mono text-[10px] leading-relaxed text-mut">
                      <div>
                        файлов: <span className="text-fg">{engine.folderInfo.fileCount}</span>
                      </div>
                      <div className="truncate">
                        последний: <span className="text-teal">{engine.folderInfo.latestName || '—'}</span>
                      </div>
                      <div>
                        время: <span className="text-fg">{engine.folderInfo.latestTime || '—'}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* кнопка подключения */}
          <button
            onClick={connect}
            disabled={tab === 'folder' && !folderSupported}
            className="flex w-full items-center justify-center gap-2 rounded-[5px] border border-teal/50 bg-teal/12 px-3 py-2.5 text-[12.5px] font-bold text-teal transition-all hover:bg-teal/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconEye className="h-4 w-4" />
            {tab === 'folder' ? 'Выбрать папку и начать наблюдение' : 'Подключить канал'}
          </button>

          {tab !== 'folder' && (
            <p className="text-center font-mono text-[9px] tracking-[0.08em] text-dim">
              после подключения канал заменяет демо-сцену · анализ идёт непрерывно
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
