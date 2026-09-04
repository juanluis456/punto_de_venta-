const { app, BrowserWindow, session } = require('electron'); // 🔥 Agregamos session
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

  // 🧹 MAGIA ANTI-CACHÉ: Borra la memoria vieja cada vez que se abre el sistema
  win.webContents.session.clearCache();

  // 🚀 MAGIA ACTIVADA: Carga tu Frontend exacto desde la nube de Vercel
  win.loadURL('https://punto-de-venta-fygnykbrh-juan-897b.vercel.app');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});