const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { readArpTable, pingSweep } = require('./src/services/arpService');

// Geliştirme modunda olup olmadığımızı kontrol etmenin en sağlam yolu.
// IS_DEV ortam değişkeni veya app.isPackaged kontrolü.
const isDev = process.env.IS_DEV === 'true' || !app.isPackaged;

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 850,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  if (isDev) {
    // Geliştirme modu: Vite sunucusuna bağlan.
    // vite.config.js'de port belirtilmediği için Vite'in varsayılan portu olan 5173'ü kullanıyoruz.
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools(); // Geliştirme araçlarını otomatik aç
  } else {
    // Production modu: Build edilmiş dosyayı yükle.
    // vite.config.js'deki outDir ayarına göre yol belirlendi.
    const indexPath = path.join(__dirname, 'dist', 'renderer', 'index.html');
    win.loadFile(indexPath);
  }
  
  // Diğer kodlar aynı kalabilir...
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS --- (Bu kısım değişmedi)

ipcMain.handle('arp:read', async () => {
  try {
    const table = await readArpTable();
    return { ok: true, table };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('arp:pingsweep', async (event, { network, rangeStart, rangeEnd }) => {
  try {
    const results = await pingSweep(network, rangeStart, rangeEnd, (progress) => {
      win.webContents.send('pingsweep:progress', progress);
    });
    return { ok: true, results };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('export:csv', async (event, data) => {
  if (!data || data.length === 0) {
    return { ok: false, error: 'Dışa aktarılacak veri yok.' };
  }
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'ARP Tablosunu Kaydet',
    defaultPath: `arp-export-${Date.now()}.csv`,
    filters: [{ name: 'CSV Dosyaları', extensions: ['csv'] }]
  });
  if (canceled || !filePath) {
    return { ok: false, error: 'İşlem iptal edildi.' };
  }
  try {
    const header = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    const csvContent = `${header}\n${rows.join('\n')}`;
    fs.writeFileSync(filePath, csvContent);
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: 'Dosya kaydedilemedi: ' + err.message };
  }
});