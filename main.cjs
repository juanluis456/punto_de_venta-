const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Limpieza agresiva de caché al iniciar
  session.defaultSession.clearCache();
  session.defaultSession.clearStorageData({
    storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shaderbase', 'websql', 'serviceworkers', 'cachestorage']
  });

  // El link de Vercel que se ve en tu foto, forzado a recargar
  const urlVercel = 'https://punto-de-venta-lake.vercel.app/?t=' + Date.now();
  
  win.loadURL(urlVercel, { extraHeaders: 'pragma: no-cache\n' });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});