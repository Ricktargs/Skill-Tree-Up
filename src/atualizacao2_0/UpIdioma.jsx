import React, { useEffect, useState } from 'react';
import './UpIdioma.css';

export const LANGUAGES = [
  { code: 'pt', name: 'Português', flag: '🇧🇷', native: 'Português' },
  { code: 'en', name: 'Inglês', flag: '🇺🇸', native: 'English' },
  { code: 'es', name: 'Espanhol', flag: '🇪🇸', native: 'Español' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', native: 'Italiano' },
  { code: 'zh-CN', name: 'Mandarim', flag: '🇨🇳', native: '中文 (简体)' },
  { code: 'ja', name: 'Japonês', flag: '🇯🇵', native: '日本語' }
];

export function LanguageProvider({ children }) {
  const [currentLang] = useState(() => {
    return localStorage.getItem('rpg_language_v1') || 'pt';
  });

  useEffect(() => {
    if (!window.googleTranslateElementInit) {
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'pt', autoDisplay: false },
          'google_translate_element'
        );
      };

      const addScript = document.createElement('script');
      addScript.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      addScript.async = true;
      document.body.appendChild(addScript);
    }

    // Se o idioma não for português, monitora novos elementos (modais) injetados pelo React
    if (currentLang !== 'pt') {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              const isModal =
                node.classList?.contains('modal-backdrop') ||
                node.querySelector?.('.modal-backdrop, .modal-window');

              if (isModal) {
                node.style.opacity = '0';
                node.style.transition = 'opacity 0.15s ease-in-out';
                setTimeout(() => {
                  node.style.opacity = '1';
                }, 180);
              }
            }
          });
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, [currentLang]);

  const changeLanguage = (langCode) => {
    localStorage.setItem('rpg_language_v1', langCode);
    document.cookie = `googtrans=/pt/${langCode}; path=/`;
    document.cookie = `googtrans=/pt/${langCode}; domain=.${window.location.hostname}; path=/`;
    window.location.reload();
  };

  return (
    <>
      <div id="google_translate_element" style={{ display: 'none' }} />
      {children}
    </>
  );
}

export function useLanguage() {
  const currentLang = localStorage.getItem('rpg_language_v1') || 'pt';

  const changeLanguage = (langCode) => {
    localStorage.setItem('rpg_language_v1', langCode);
    document.cookie = `googtrans=/pt/${langCode}; path=/`;
    document.cookie = `googtrans=/pt/${langCode}; domain=.${window.location.hostname}; path=/`;
    window.location.reload();
  };

  return { currentLang, changeLanguage, t: (k, fallback) => fallback || k, LANGUAGES };
}

export function UpIdiomaModal({ isOpen, onClose, playSound }) {
  const { currentLang, changeLanguage } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop high-z-backdrop" onClick={() => { if (playSound) playSound('click'); onClose(); }}>
      <div className="modal-window up-idioma-modal high-z-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <h3 className="up-idioma-modal-title">🌐 Opções de Idioma</h3>
          <button type="button" className="close-popup-btn" onClick={() => { if (playSound) playSound('click'); onClose(); }}>✕</button>
        </div>

        <p className="up-idioma-modal-desc">Escolha o idioma do sistema. Toda a interface será traduzida automaticamente.</p>

        <div className="up-idioma-grid">
          {LANGUAGES.map((lang) => {
            const isActive = currentLang === lang.code;
            return (
              <div
                key={lang.code}
                className={`up-idioma-card ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (playSound) playSound('train');
                  changeLanguage(lang.code);
                }}
                style={{ cursor: 'pointer' }}
              >
                <span className="up-idioma-flag">{lang.flag}</span>
                <div className="up-idioma-info">
                  <strong className="up-idioma-name">{lang.native}</strong>
                  <span className="up-idioma-code">{lang.name}</span>
                </div>
                {isActive && <span className="up-idioma-active-badge">✓</span>}
              </div>
            );
          })}
        </div>

        <div className="modal-actions-bar" style={{ marginTop: '1.2rem' }}>
          <button
            type="button"
            className="confirm-button"
            style={{ width: '100%' }}
            onClick={() => { if (playSound) playSound('click'); onClose(); }}
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}