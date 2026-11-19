import { useEffect, useState } from 'react';
import { tx } from '../i18n/index.jsx';

// Aviso rápido que aparece ao usar Ctrl+Z / Ctrl+Y em qualquer lugar do programa
export default function UndoToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer = null;
    const onToast = (e) => {
      clearTimeout(timer);
      setToast(e.detail);
      timer = setTimeout(() => setToast(null), 1400);
    };
    window.addEventListener('rpg-undo-toast', onToast);
    return () => {
      window.removeEventListener('rpg-undo-toast', onToast);
      clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        // acima da barra Neurônios / Santuário / Habilidades
        bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)',
        zIndex: 2000000,
        padding: '0.55rem 1.1rem',
        borderRadius: 999,
        background: 'var(--theme-modal-bg, #0f172a)',
        border: '1px solid var(--theme-accent, #38bdf8)',
        color: '#e2e8f0',
        fontWeight: 700,
        fontSize: '0.9rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        pointerEvents: 'none',
        animation: 'ckToastIn 0.18s ease'
      }}
    >
      {toast.kind === 'undo' ? `↶ ${tx('Desfeito')}` : `↷ ${tx('Refeito')}`}
    </div>
  );
}
