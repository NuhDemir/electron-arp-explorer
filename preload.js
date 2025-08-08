const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readArp: () => ipcRenderer.invoke('arp:read'),
  pingSweep: (opts) => ipcRenderer.invoke('arp:pingsweep', opts),
  exportCsv: (data) => ipcRenderer.invoke('export:csv', data),
  onPingSweepProgress: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('pingsweep:progress', listener);
    return () => {
      ipcRenderer.removeListener('pingsweep:progress', listener);
    };
  }
});