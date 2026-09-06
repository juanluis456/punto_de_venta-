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

  // 🧹 LIMPIEZA EXTREMA Y DEFINITIVA
  session.defaultSession.clearCache();
  session.defaultSession.clearStorageData();

  // 🚀 CONEXIÓN EN LÍNEA: Le agregamos la hora exacta al final del enlace 
  // para forzar a Electron a jalar la versión más fresca de Vercel siempre.
  const urlVercel = 'https://punto-de-venta-fygnykbrh-juan-897b.vercel.app/?t=' + Date.now();
  
  win.loadURL(urlVercel, { extraHeaders: 'pragma: no-cache\n' });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});