// Ponte segura entre o app de PC e a página do ORBE-G
// (a página só enxerga estas funções, nada mais do computador)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbeDesktop', {
  isDesktop: true,
  // { closeToTray, openAtLogin }
  getSettings: () => ipcRenderer.invoke('orbe:get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('orbe:set-settings', patch),
  openExternal: (url) => ipcRenderer.invoke('orbe:open-external', url),
  platform: process.platform, // 'win32' | 'darwin' | 'linux'
  // janela foi para a bandeja (false) ou voltou (true)
  onWindowVisibility: (cb) => {
    const h = (_e, visible) => cb(Boolean(visible));
    ipcRenderer.on('orbe:window-visibility', h);
    return () => ipcRenderer.removeListener('orbe:window-visibility', h);
  },
  getInfo: () => ipcRenderer.invoke('orbe:info'),
  // Atualização (Windows: baixa e instala sozinho)
  checkUpdate: () => ipcRenderer.invoke('orbe:update-check'),
  installUpdate: () => ipcRenderer.invoke('orbe:update-install'),
  onUpdateState: (cb) => {
    const h = (_e, state) => cb(state);
    ipcRenderer.on('orbe:update-state', h);
    return () => ipcRenderer.removeListener('orbe:update-state', h);
  }
});
