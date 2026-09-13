const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// ===== Настройка логирования =====
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
autoUpdater.logger = log;

// ===== Настройка autoUpdater =====
autoUpdater.autoDownload = true;          // Скачивать автоматически
autoUpdater.autoInstallOnAppQuit = true;  // Установить при выходе
autoUpdater.allowPrerelease = false;      // Только стабильные релизы

// ===== Обработчики событий autoUpdater =====
autoUpdater.on('checking-for-update', () => {
  log.info('[autoUpdater] Проверка обновлений...');
});

autoUpdater.on('update-available', (info) => {
  log.info('[autoUpdater] Обновление найдено:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  log.info('[autoUpdater] Обновлений нет. Текущая версия:', info.version);
});

autoUpdater.on('error', (err) => {
  log.error('[autoUpdater] Ошибка:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  log.info(`[autoUpdater] Загрузка: ${progressObj.percent.toFixed(1)}% (${progressObj.transferred}/${progressObj.total})`);
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('[autoUpdater] Обновление скачано:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

// ===== Главное окно =====
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Проверка обновлений после старта (через 10 секунд)
  setTimeout(() => {
    log.info('[main] Запуск проверки обновлений...');
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      log.error('[main] Ошибка checkForUpdates:', err);
    });
  }, 10_000);

  // Повторная проверка каждые 4 часа
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  setInterval(() => {
    log.info('[main] Плановая проверка обновлений...');
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      log.error('[main] Ошибка checkForUpdates:', err);
    });
  }, FOUR_HOURS);
}

// ===== IPC-хендлеры (на будущее, для UI обновлений) =====
ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates());
ipcMain.handle('download-update', () => autoUpdater.downloadUpdate());
ipcMain.handle('install-update', () => {
  setImmediate(() => autoUpdater.quitAndInstall());
});
ipcMain.handle('get-app-version', () => app.getVersion());

// ===== Жизненный цикл приложения =====
app.whenReady().then(() => {
  log.info('[main] Приложение запущено. Версия:', app.getVersion());
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
