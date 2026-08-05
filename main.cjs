const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true, // 🔥 Esto oculta el menú feo de Windows arriba para que se vea más profesional
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 🚀 AQUÍ ESTÁ LA MAGIA: Carga la app directo de la nube para que se actualice sola
  win.loadURL('https://punto-de-venta-wjqo.onrender.com');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});