const { app, BrowserWindow } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'debug';
log.info('App starting...');

autoUpdater.on('checking-for-update', () => log.info('Проверка обновлений...'));
autoUpdater.on('update-available', (info) => log.info('Обновление найдено:', info));
autoUpdater.on('update-not-available', (info) => log.info('Обновлений нет:', info));
autoUpdater.on('error', (err) => log.error('Ошибка обновления:', err));
autoUpdater.on('download-progress', (p) => log.info('Загрузка:', p.percent, '%'));
autoUpdater.on('update-downloaded', (info) => log.info('Обновление скачано:', info));

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

  // Проверка обновлений после запуска
  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
