// Ponte segura entre o app de PC e a página do ORBE-G
// (a página só enxerga estas funções, nada mais do computador)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbeDesktop', {
  isDesktop: true,
  // { closeToTray, openAtLogin }
  getSettings: () => ipcRenderer.invoke('orbe:get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('orbe:set-settings', patch),
  openExternal: (url) => ipcRenderer.invoke('orbe:open-external', url)
});
