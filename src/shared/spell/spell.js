// =========================================================
// CORRETOR: ponte entre a página e o corretor em segundo plano
//   checkWord(word)      -> { ok, suggestions } (até 5)
//   wordAtPoint(field, x, y) -> { word, apply(newText) } ou null
//   addToDictionary(word)
// Vale em qualquer lugar onde se escreve (notas, neurônios, caixas de
// texto, campos de uma linha) — no PC, no site e no celular.
// =========================================================
import SpellWorker from './spellWorker.js?worker&inline';
import { getLanguage } from '../../i18n/index.jsx';

const PERSONAL_KEY = 'orbe-spell-personal';
const readPersonal = () => {
  try {
    const v = JSON.parse(localStorage.getItem(PERSONAL_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const langOrder = () => {
  const l = getLanguage();
  if (l === 'en') return ['en', 'pt', 'es'];
  if (l === 'es') return ['es', 'pt', 'en'];
  return ['pt', 'en', 'es'];
};

let worker = null;
let seq = 0;
const pending = new Map();
let readyLangs = new Set();

function ensureWorker() {
  if (worker) return worker;
  try {
    worker = new SpellWorker();
  } catch {
    worker = null;
    return null;
  }
  worker.onmessage = (e) => {
    const d = e.data || {};
    if (d.type === 'ready') {
      readyLangs.add(d.lang);
      return;
    }
    if (d.type === 'error') return;
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    if (d.error) p.reject(new Error(d.error));
    else p.resolve(d);
  };
  worker.postMessage({ type: 'init', langs: langOrder(), personal: readPersonal() });
  return worker;
}

/** Começa a preparar o corretor (baixa os dicionários na primeira vez). */
export function warmUpSpell() {
  ensureWorker();
}
export const isSpellReady = () => readyLangs.has(langOrder()[0]);

export function checkWord(word, context = '') {
  const w = ensureWorker();
  if (!w) return Promise.reject(new Error('sem corretor'));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: 'check', id, word, context, langs: langOrder() });
    // primeira vez baixando os dicionários pode demorar um pouco
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('timeout'));
      }
    }, 60000);
  });
}

// pedido genérico ao corretor em segundo plano
function ask(msg, timeout = 90000) {
  const w = ensureWorker();
  if (!w) return Promise.reject(new Error('sem corretor'));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...msg, id });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('timeout'));
      }
    }, timeout);
  });
}
/** Grupos de sinônimos do thesaurus (tenta as chaves em ordem). */
export const thesaurusLookup = (keys) => ask({ type: 'thes', keys }).then((r) => ({ key: r.key, groups: r.groups || [] }));
/** Só as palavras que existem no dicionário (português). */
export const validWords = (words) => ask({ type: 'validate', words, langs: ['pt'] }).then((r) => r.valid || []);

export function addToDictionary(word) {
  const w = String(word || '').trim();
  if (!w) return;
  const list = readPersonal();
  if (!list.includes(w)) {
    list.push(w);
    try {
      localStorage.setItem(PERSONAL_KEY, JSON.stringify(list));
    } catch {
      /* sem espaço */
    }
  }
  const wk = ensureWorker();
  if (wk) wk.postMessage({ type: 'add', id: ++seq, word: w });
}

// ---------- palavra debaixo do clique ----------
const WORD_CH = /[\p{L}\p{M}'’-]/u;
const wordBounds = (text, at) => {
  let a = at;
  let b = at;
  while (a > 0 && WORD_CH.test(text[a - 1])) a--;
  while (b < text.length && WORD_CH.test(text[b])) b++;
  while (a < b && /['’-]/.test(text[a])) a++;
  while (b > a && /['’-]/.test(text[b - 1])) b--;
  return b - a >= 2 ? [a, b] : null;
};

// Caixa de texto/campo: descobre a posição do clique com uma cópia invisível
// do campo (mesma fonte, tamanho e rolagem)
const MIRROR_PROPS = [
  'boxSizing', 'width', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'letterSpacing', 'wordSpacing',
  'lineHeight', 'textTransform', 'textIndent', 'textAlign', 'tabSize', 'direction'
];
function indexInBox(el, x, y) {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const m = document.createElement('div');
  MIRROR_PROPS.forEach((p) => {
    m.style[p] = cs[p];
  });
  const isArea = el.tagName === 'TEXTAREA';
  m.style.position = 'fixed';
  m.style.left = `${r.left}px`;
  m.style.top = `${r.top}px`;
  m.style.margin = '0';
  m.style.overflow = 'hidden';
  m.style.whiteSpace = isArea ? 'pre-wrap' : 'pre';
  m.style.wordWrap = 'break-word';
  m.style.color = 'transparent';
  m.style.background = 'transparent';
  m.style.zIndex = '2147483647';
  m.style.pointerEvents = 'auto';
  m.textContent = el.value + '\u200b';
  document.body.appendChild(m);
  m.scrollTop = el.scrollTop;
  m.scrollLeft = el.scrollLeft;
  // campo de uma linha: centraliza na vertical como o input faz
  if (!isArea) {
    m.style.display = 'flex';
    m.style.alignItems = 'center';
  }
  let idx = null;
  try {
    const pos = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    if (pos && m.contains(pos.startContainer)) idx = pos.startOffset;
  } finally {
    m.remove();
  }
  return idx;
}

/**
 * Palavra debaixo do clique dentro de um campo de escrita.
 * Devolve { word, apply(nova) } — apply troca a palavra (entra no Ctrl+Z).
 */
export function wordAtPoint(field, x, y) {
  if (!field) return null;
  // caixa de texto / campo de uma linha
  if ('value' in field && typeof field.setSelectionRange === 'function') {
    const at = indexInBox(field, x, y);
    if (at == null) return null;
    const text = field.value;
    const b = wordBounds(text, Math.min(at, text.length));
    if (!b) return null;
    const [s, e] = b;
    return {
      word: text.slice(s, e),
      context: text.slice(Math.max(0, s - 160), e + 160),
      apply: (nova) => {
        field.focus();
        field.setSelectionRange(s, e);
        let done = false;
        try {
          done = document.execCommand('insertText', false, nova);
        } catch {
          done = false;
        }
        if (!done || field.value.slice(s, s + nova.length) !== nova) {
          field.setRangeText(nova, s, e, 'end');
          field.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    };
  }
  // texto rico (notas, neurônios)
  if (!field.isContentEditable || !document.caretRangeFromPoint) return null;
  const pos = document.caretRangeFromPoint(x, y);
  if (!pos || pos.startContainer.nodeType !== 3 || !field.contains(pos.startContainer)) return null;
  const node = pos.startContainer;
  const b = wordBounds(node.data, pos.startOffset);
  if (!b) return null;
  const range = document.createRange();
  range.setStart(node, b[0]);
  range.setEnd(node, b[1]);
  const block = node.parentElement && node.parentElement.closest('p, li, div, h1, h2, h3, blockquote, pre, td') ;
  const ctx = (block && field.contains(block) ? block.textContent : node.data) || '';
  return {
    word: node.data.slice(b[0], b[1]),
    context: ctx.slice(0, 400),
    apply: (nova) => {
      field.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, nova);
    }
  };
}
