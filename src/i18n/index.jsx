import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUndoRestore } from '../atualizacao2_0/GlobalUndo.js';
import en from './en.js';
import es from './es.js';
import it from './it.js';
import zhCN from './zh-CN.js';
import ja from './ja.js';

// =========================================================
// Tradução própria do app (substitui o widget do Google Tradutor).
//
// Como funciona: o texto em português é a "chave". `tx('Fechar')` devolve a
// tradução do idioma atual ou o próprio texto se ainda não houver tradução.
// Variáveis: tx('Faltam {n} dias', { n: 3 }).
// Os dados do usuário (nomes de habilidades, tarefas...) NÃO passam por aqui.
// =========================================================

export const LANGUAGES = [
  { code: 'pt', flag: '🇧🇷', native: 'Português' },
  { code: 'en', flag: '🇺🇸', native: 'English' },
  { code: 'es', flag: '🇪🇸', native: 'Español' },
  { code: 'it', flag: '🇮🇹', native: 'Italiano' },
  { code: 'zh-CN', flag: '🇨🇳', native: '中文 (简体)' },
  { code: 'ja', flag: '🇯🇵', native: '日本語' }
];

const DICTIONARIES = { en, es, it, 'zh-CN': zhCN, ja };

const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', it: 'it-IT', 'zh-CN': 'zh-CN', ja: 'ja-JP' };

const STORAGE_KEY = 'rpg_language_v1';

const readSavedLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === saved) ? saved : 'pt';
  } catch (e) {
    return 'pt';
  }
};

// Idioma atual em nível de módulo: assim hooks e funções fora de componentes
// também conseguem traduzir (tx) e formatar datas (getLocale).
let currentLang = readSavedLanguage();

export const getLanguage = () => currentLang;
export const getLocale = () => LOCALES[currentLang] || 'pt-BR';

export function tx(text, vars) {
  if (text === null || text === undefined) return text;
  const source = String(text);
  const dict = DICTIONARIES[currentLang];
  let out = (dict && dict[source]) || source;
  if (vars) out = out.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
  return out;
}

// Remove o cookie e os restos do Google Tradutor usado anteriormente
const cleanupGoogleTranslate = () => {
  try {
    const expire = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
    const host = window.location.hostname;
    document.cookie = `googtrans=; ${expire}; path=/`;
    document.cookie = `googtrans=; ${expire}; path=/; domain=${host}`;
    document.cookie = `googtrans=; ${expire}; path=/; domain=.${host}`;
    document.querySelectorAll('.skiptranslate, #google_translate_element, iframe.goog-te-banner-frame').forEach((el) => el.remove());
    document.body.style.top = '';
  } catch (e) {}
};

const LanguageContext = createContext({ lang: currentLang, setLanguage: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(currentLang);

  useEffect(() => {
    cleanupGoogleTranslate();
  }, []);

  useEffect(() => {
    document.documentElement.lang = LOCALES[lang] || 'pt-BR';
  }, [lang]);

  useUndoRestore(
    (k) => k === STORAGE_KEY,
    () => {
      const code = readSavedLanguage();
      currentLang = code;
      setLang(code);
    }
  );

  const setLanguage = useCallback((code) => {
    if (!LANGUAGES.some((l) => l.code === code)) return;
    // Atualiza a variável do módulo ANTES de re-renderizar, para que tx() já
    // devolva o idioma novo nesta mesma renderização
    currentLang = code;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (e) {}
    setLang(code);
  }, []);

  return <LanguageContext.Provider value={{ lang, setLanguage }}>{children}</LanguageContext.Provider>;
}

// Usado pelos componentes: além das funções, faz o componente re-renderizar
// quando o idioma muda.
export function useLanguage() {
  const { lang, setLanguage } = useContext(LanguageContext);
  return {
    lang,
    currentLang: lang,
    setLanguage,
    changeLanguage: setLanguage,
    t: tx,
    tx,
    locale: LOCALES[lang] || 'pt-BR',
    LANGUAGES
  };
}
