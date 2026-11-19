// =========================================================
// ORBE-G — app de PC (Electron)
// Abre o mesmo programa do site (dist/index.html) numa janela própria,
// com ícone, atalho na área de trabalho e som da abertura sempre ligado.
// - Fechar a janela deixa o ORBE-G na bandeja (perto do relógio)
// - Pode iniciar junto com o PC (já na bandeja)
// As duas opções ficam nas Configurações (⚙️) do programa.
// =========================================================
const { app, BrowserWindow, Menu, Tray, ipcMain, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

// O som da abertura toca sem precisar de clique (no navegador isso é bloqueado)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('com.orbeg.app');

// Um ORBE-G aberto por vez: abrir de novo só traz a janela para frente
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const ICON = path.join(__dirname, '..', 'dist', 'favicon.ico');
const STARTED_HIDDEN = process.argv.includes('--hidden');
let win = null;
let tray = null;
let quitting = false;
let trayTipShown = false;

// ---------- Opções do app de PC (guardadas num arquivo) ----------
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'desktop-settings.json');
const DEFAULTS = { closeToTray: true, openAtLogin: false };
let settings = { ...DEFAULTS };
function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')) };
  } catch {
    settings = { ...DEFAULTS };
  }
  // o Windows é quem sabe se está mesmo iniciando junto
  if (app.isPackaged) settings.openAtLogin = app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin;
}
function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2));
  } catch {
    /* só não lembra */
  }
}
function applyLogin() {
  // No modo de desenvolvimento registraria o electron.exe, então só no app instalado
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: Boolean(settings.openAtLogin), args: ['--hidden'] });
}

// ---------- Janela ----------
function showWindow() {
  if (!win) return createWindow(true);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow(show = true) {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 420,
    minHeight: 500,
    show: false,
    title: 'ORBE-G',
    icon: ICON,
    backgroundColor: '#0b0f1a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });
  Menu.setApplicationMenu(null);

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.once('ready-to-show', () => {
    if (!show) return;
    win.maximize();
    win.show();
  });

  // Fechar = ficar na bandeja (se a opção estiver ligada)
  win.on('close', (e) => {
    if (quitting || !settings.closeToTray) return;
    e.preventDefault();
    win.hide();
    if (!trayTipShown && tray) {
      trayTipShown = true;
      try {
        tray.displayBalloon({
          iconType: 'info',
          title: 'O ORBE-G continua aberto',
          content: 'Ele ficou aqui na bandeja. Clique no ícone para voltar ou em "Sair" para fechar de vez.'
        });
      } catch {
        /* sem balão neste Windows */
      }
    }
  });

  // Links para sites abrem no navegador, não dentro do app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (/^https?:/i.test(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // F11 = tela cheia · Ctrl+Shift+I = ferramentas (para investigar problemas)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });

  win.on('closed', () => {
    win = null;
  });
  return win;
}

// ---------- Bandeja ----------
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Abrir ORBE-G', click: showWindow },
    { type: 'separator' },
    {
      label: 'Manter na bandeja ao fechar',
      type: 'checkbox',
      checked: settings.closeToTray,
      click: (item) => updateSettings({ closeToTray: item.checked })
    },
    {
      label: 'Iniciar junto com o PC',
      type: 'checkbox',
      checked: settings.openAtLogin,
      enabled: app.isPackaged,
      click: (item) => updateSettings({ openAtLogin: item.checked })
    },
    { type: 'separator' },
    {
      label: 'Sair do ORBE-G',
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]);
}
function createTray() {
  const img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('ORBE-G');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}

function updateSettings(patch) {
  settings = { ...settings, ...patch };
  if ('openAtLogin' in patch) applyLogin();
  saveSettings();
  if (tray) tray.setContextMenu(buildTrayMenu());
  return { ...settings, canStartWithPc: app.isPackaged };
}

// ---------- Conversa com a página (Configurações) ----------
ipcMain.handle('orbe:get-settings', () => ({ ...settings, canStartWithPc: app.isPackaged }));
ipcMain.handle('orbe:set-settings', (_e, patch) => {
  const clean = {};
  if (patch && typeof patch.closeToTray === 'boolean') clean.closeToTray = patch.closeToTray;
  if (patch && typeof patch.openAtLogin === 'boolean') clean.openAtLogin = patch.openAtLogin;
  return updateSettings(clean);
});
ipcMain.handle('orbe:open-external', (_e, url) => {
  if (typeof url === 'string' && /^https:\/\//i.test(url)) shell.openExternal(url);
});

// ---------- Atualização automática (Windows) ----------
// Procura a versão nova nos Releases do GitHub; ao clicar em "Atualizar"
// baixa, fecha e reinstala sozinho. No Mac (app sem assinatura da Apple)
// a página baixa o instalador novo pelo navegador.
let updater = null;
let updateState = { status: 'idle' };
const sendUpdate = (patch) => {
  updateState = { ...updateState, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send('orbe:update-state', updateState);
};
const canSelfUpdate = () => app.isPackaged && process.platform === 'win32';
function setupUpdater() {
  if (!canSelfUpdate()) return;
  try {
    ({ autoUpdater: updater } = require('electron-updater'));
  } catch {
    updater = null;
    return;
  }
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.on('checking-for-update', () => sendUpdate({ status: 'checking' }));
  updater.on('update-available', (info) => sendUpdate({ status: 'available', version: info.version }));
  updater.on('update-not-available', () => sendUpdate({ status: 'none' }));
  updater.on('download-progress', (p) => sendUpdate({ status: 'downloading', progress: Math.round(p.percent || 0) }));
  updater.on('update-downloaded', (info) => {
    sendUpdate({ status: 'ready', version: info.version });
    if (updateState.installNow) {
      setTimeout(() => {
        quitting = true;
        updater.quitAndInstall(false, true);
      }, 600);
    }
  });
  updater.on('error', (err) => sendUpdate({ status: 'error', error: String((err && err.message) || err).slice(0, 200) }));
  const check = () => updater.checkForUpdates().catch(() => {});
  setTimeout(check, 8000);
  setInterval(check, 6 * 60 * 60 * 1000);
}
ipcMain.handle('orbe:info', () => ({ version: app.getVersion(), platform: process.platform, packaged: app.isPackaged, selfUpdate: canSelfUpdate() }));
ipcMain.handle('orbe:update-check', async () => {
  if (!updater) return { status: 'unsupported' };
  try {
    await updater.checkForUpdates();
  } catch {
    /* o estado de erro já foi enviado */
  }
  return updateState;
});
ipcMain.handle('orbe:update-install', async () => {
  if (!updater) return { status: 'unsupported' };
  if (updateState.status === 'ready') {
    quitting = true;
    updater.quitAndInstall(false, true);
    return updateState;
  }
  sendUpdate({ status: 'downloading', progress: 0, installNow: true });
  updater.downloadUpdate().catch(() => {});
  return updateState;
});

app.on('second-instance', showWindow);
app.on('before-quit', () => {
  quitting = true;
});

app.whenReady().then(() => {
  loadSettings();
  createTray();
  setupUpdater();
  // Iniciou junto com o PC: fica quietinho na bandeja (a janela — e a
  // abertura com som — só aparece quando clicar no ícone)
  if (!STARTED_HIDDEN) createWindow(true);
});
// Com a bandeja ligada o app continua rodando sem janela
app.on('window-all-closed', () => {
  if (!settings.closeToTray) app.quit();
});
