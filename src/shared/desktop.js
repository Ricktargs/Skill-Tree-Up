// =========================================================
// APP DE PC (Electron) — o que a página sabe sobre ele
// No navegador/site, window.orbeDesktop não existe.
// =========================================================
import { useEffect, useState } from 'react';

export const desktop = typeof window !== 'undefined' ? window.orbeDesktop || null : null;
export const isDesktopApp = Boolean(desktop && desktop.isDesktop);

// Instalador mais novo (GitHub → Releases → Latest)
export const DOWNLOAD_URL = 'https://github.com/Ricktargs/Skill-Tree-Up/releases/latest/download/ORBE-G-Instalador.exe';
export const RELEASES_URL = 'https://github.com/Ricktargs/Skill-Tree-Up/releases/latest';

export const openLink = (url) => {
  if (isDesktopApp && desktop.openExternal) desktop.openExternal(url);
  else window.open(url, '_blank', 'noopener');
};

// Opções do app de PC: { closeToTray, openAtLogin, canStartWithPc }
export function useDesktopSettings() {
  const [value, setValue] = useState(null);
  useEffect(() => {
    if (!isDesktopApp) return undefined;
    let alive = true;
    desktop
      .getSettings()
      .then((s) => alive && setValue(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const update = (patch) => {
    if (!isDesktopApp) return;
    setValue((v) => ({ ...(v || {}), ...patch }));
    desktop
      .setSettings(patch)
      .then((s) => setValue(s))
      .catch(() => {});
  };
  return [value, update];
}
