// =========================================================
// COLAR TEXTO NOS EDITORES (Notas, Neurônios e Santuário)
// Quase todo programa coloca DUAS versões na área de transferência:
// a formatada (HTML) e a de texto puro. A de texto puro guarda as linhas,
// linhas em branco, recuos e tabs exatamente; a formatada muitas vezes
// perde isso (cada linha vira um bloco com margem, espaços feitos por CSS…).
// Regra: o texto puro vence, a não ser que o que foi copiado tenha
// formatação de verdade (listas, títulos, tabela, negrito, link, código,
// imagem) E o HTML não tenha perdido linhas.
// =========================================================
import { sanitizeHtml, escapeHtml } from '../modes/arvore/lib/html.js';

export const NBSP = ' ';

export const keepSpaces = (t) =>
  escapeHtml(t)
    .replace(/\t/g, NBSP.repeat(4))
    .replace(/ {2,}/g, (m) => `${NBSP.repeat(m.length - 1)} `)
    .replace(/^ /, NBSP);

/** Texto puro → linhas com <br> (exatamente como foi copiado). */
export function plainToLines(text) {
  const t = String(text || '').replace(/\r\n?/g, '\n');
  const html = t.split('\n').map(keepSpaces).join('<br>');
  // <br> no fim de um bloco não aparece: termina com quebra → mais uma
  return /\n$/.test(t) ? `${html}<br>` : html;
}

/** HTML colado (sites, Word, Google Docs, VS Code) com o espaçamento certo. */
export function normalizePastedHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.remove());
  [...body.getElementsByTagName('*')].forEach((el) => {
    if (/:/.test(el.tagName)) el.remove(); // <o:p> do Word etc.
  });
  body.querySelectorAll('b[id^="docs-internal-guid"]').forEach((b) => b.replaceWith(...b.childNodes));
  const preLike = [...body.querySelectorAll('[style]')].filter((el) => /white-space\s*:\s*(pre|break-spaces)/i.test(el.getAttribute('style') || ''));
  preLike.forEach((el) => {
    if (el.closest('pre')) return;
    const tw = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (tw.nextNode()) texts.push(tw.currentNode);
    texts.forEach((t) => {
      if (!t.nodeValue) return;
      const frag = doc.createDocumentFragment();
      t.nodeValue.split('\n').forEach((part, i) => {
        if (i) frag.appendChild(doc.createElement('br'));
        const fixed = part.replace(/\t/g, NBSP.repeat(4)).replace(/ {2,}/g, (m) => `${NBSP.repeat(m.length - 1)} `).replace(/^ /, NBSP);
        if (fixed) frag.appendChild(doc.createTextNode(fixed));
      });
      t.replaceWith(frag);
    });
  });
  body.querySelectorAll('p, div, li, h1, h2, h3, h4').forEach((el) => {
    if (!el.textContent.replace(/ /g, ' ').trim() && !el.querySelector('img, br, hr')) el.innerHTML = '<br>';
  });
  return body.innerHTML;
}

const RICH_RE = /<(ul|ol|table|h[1-6]|img|pre|blockquote|b|strong|i|em|u|s|strike|code|a\s[^>]*href)\b/i;
const countLines = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = doc.body.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr, br, pre, blockquote').length;
  const preLines = [...doc.body.querySelectorAll('pre')].reduce((n, p) => n + (p.textContent.match(/\n/g) || []).length, 0);
  return blocks + preLines;
};

/** O que colar: HTML limpo com formatação, ou o texto puro linha a linha. */
export function pasteHtmlFrom(clipboardData) {
  const html = clipboardData.getData('text/html') || '';
  const text = clipboardData.getData('text/plain') || '';
  if (html.trim()) {
    // o Google Docs embrulha tudo num <b> que não é negrito: olha depois de tirar
    const normalized = normalizePastedHtml(html);
    const rich = RICH_RE.test(normalized);
    const textLines = text ? text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').length : 0;
    const lostLines = text && countLines(html) + 1 < textLines;
    if (rich && !lostLines) {
      return sanitizeHtml(normalized)
        .replace(/\scontenteditable="[^"]*"/gi, '')
        .replace(/\s(style|class|id|width|height|dir|lang)="[^"]*"/gi, '');
    }
  }
  return text ? plainToLines(text) : '';
}

/** Põe o HTML no lugar do cursor sem o navegador mexer na estrutura
 *  (o insertHTML do Chrome junta/perde linhas e parágrafos). */
const BLOCK_RE = /^(P|DIV|UL|OL|PRE|H[1-6]|BLOCKQUOTE|FIGURE|TABLE|HR)$/;
export function insertHtmlAt(el, html) {
  const sel = window.getSelection();
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const nodes = [...tpl.content.childNodes];
  if (!nodes.length) return;
  if (!sel || !sel.rangeCount || !el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    nodes.forEach((n) => el.appendChild(n));
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const isBlock = (n) => n.nodeType === 1 && BLOCK_RE.test(n.tagName);
  const last = nodes[nodes.length - 1];
  let block = range.startContainer;
  while (block && block.parentNode !== el) block = block.parentNode;
  if (nodes.some(isBlock) && block && block !== el) {
    // divide o parágrafo onde está o cursor e encaixa os blocos no meio
    const tailRange = document.createRange();
    tailRange.setStart(range.startContainer, range.startOffset);
    tailRange.setEnd(block, block.childNodes.length);
    const tail = tailRange.extractContents();
    const tailBlock = block.nodeType === 1 ? block.cloneNode(false) : document.createElement('p');
    tailBlock.appendChild(tail);
    let i = 0;
    if (block.nodeType === 1) {
      while (i < nodes.length && !isBlock(nodes[i])) block.appendChild(nodes[i++]);
    }
    let ref = block;
    for (; i < nodes.length; i++) {
      ref.after(nodes[i]);
      ref = nodes[i];
    }
    const empty = (b) => b.nodeType === 1 && !b.textContent.replace(/ /g, ' ').trim() && !b.querySelector('img, a, hr');
    if (!empty(tailBlock)) ref.after(tailBlock);
    if (empty(block) && block !== ref) block.remove();
  } else {
    const frag = document.createDocumentFragment();
    nodes.forEach((n) => frag.appendChild(n));
    range.insertNode(frag);
  }
  if (!last.isConnected) return;
  const r = document.createRange();
  if (last.nodeType === 1 && !/^(BR|IMG|HR)$/.test(last.tagName)) {
    r.selectNodeContents(last);
    r.collapse(false);
  } else {
    r.setStartAfter(last);
    r.collapse(true);
  }
  sel.removeAllRanges();
  sel.addRange(r);
}
