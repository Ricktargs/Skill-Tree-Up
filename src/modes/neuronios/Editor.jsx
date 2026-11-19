import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ask } from '../../shared/Dialog.jsx';
import SkillLink from '../../shared/SkillLink.jsx';
import { sfx } from '../arvore/lib/sound.js';
import { cleanHtml, escapeHtml, linksIn, normalizeTag, pagelinkHtml, pagesIn, plainText, tagColor, wikilinkHtml } from './store.js';
import ColorPicker from './ColorPicker.jsx';

// Cores do marca-texto (a escolhida fica lembrada)
const HIGHLIGHT_COLORS = ['#f6e7a1', '#fde68a', '#bbf7d0', '#a7f3d0', '#bae6fd', '#c7d2fe', '#fbcfe8', '#fecaca', '#fed7aa', '#e9d5ff'];
const HL_KEY = 'nr-highlight-color';
const HL_ALPHA_KEY = 'nr-highlight-alpha';
const loadHlAlpha = () => {
  try {
    const v = Number(localStorage.getItem(HL_ALPHA_KEY));
    return v >= 0.1 && v <= 1 ? v : 0.45; // mais transparente por padrão
  } catch {
    return 0.45;
  }
};
// #rrggbb + opacidade → rgba(...)
const withAlpha = (hex, a) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
};

// Cor do lápis (cor do texto)
const TEXT_COLORS = ['#1f2937', '#64748b', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#f8fafc', '#93c5fd'];
const TEXT_KEY = 'nr-text-color';
const loadTextColor = () => {
  try {
    return localStorage.getItem(TEXT_KEY) || '#2563eb';
  } catch {
    return '#2563eb';
  }
};
const loadHl = () => {
  try {
    return localStorage.getItem(HL_KEY) || HIGHLIGHT_COLORS[0];
  } catch {
    return HIGHLIGHT_COLORS[0];
  }
};

// Imagem → texto (data URL), diminuída para não lotar o espaço do navegador
const MAX_IMG_SIDE = 1100;
const readImage = (file) =>
  new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('não é imagem'));
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = reader.result;
      // GIF pequeno fica como está (para manter a animação)
      if (file.type === 'image/gif' && file.size < 1.2 * 1024 * 1024) return resolve(src);
      const img = new Image();
      img.onerror = () => reject(new Error('imagem inválida'));
      img.onload = () => {
        const k = Math.min(1, MAX_IMG_SIDE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k));
        const h = Math.max(1, Math.round(img.height * k));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let out = canvas.toDataURL('image/webp', 0.82);
        if (!out.startsWith('data:image/webp')) out = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
        resolve(out);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });

// =========================================================
// EDITOR DO NEURÔNIO (fica ao lado do mapa)
// Abas · título · tags · barra de formatação · [[ligações]]
// Atalhos de escrita: "# ", "## ", "### ", "- ", "1. ", "> ", "[] "
// +Pag cria uma página dentro do neurônio: um texto dentro do texto,
// que abre numa janela dentro da janela (e pode ter páginas dentro dela)
// =========================================================

const BLOCKS = [
  ['p', 'Parágrafo'],
  ['h1', 'Título 1'],
  ['h2', 'Título 2'],
  ['h3', 'Título 3'],
  ['blockquote', 'Citação'],
  ['pre', 'Bloco de código']
];

// O que foi digitado logo antes do cursor abre a lista de sugestões
const TRIGGERS = {
  page: /\+pag(?:[ \u00a0]([^\n+]{0,40}))?$/i,
  link: /\[\[([^\]\n[]{0,40})$/
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora mesmo';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Bloco (parágrafo, título, item...) onde está o cursor
const currentBlock = (editor) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node = sel.anchorNode;
  while (node && node !== editor) {
    if (node.nodeType === 1 && /^(P|DIV|H1|H2|H3|LI|BLOCKQUOTE|PRE)$/.test(node.tagName)) return node;
    node = node.parentNode;
  }
  return null;
};

// ---------- Formatos que "grudam" no cursor ----------
// Elemento em volta do cursor que passa no teste (ex.: <code>, marca-texto)
const inlineAncestor = (editor, test) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node = sel.anchorNode;
  while (node && node !== editor) {
    if (node.nodeType === 1 && test(node)) return node;
    node = node.parentNode;
  }
  return null;
};
const isHighlight = (el) =>
  el.tagName === 'MARK' || Boolean(el.style && el.style.backgroundColor && !/transparent|rgba\(0, 0, 0, 0\)/.test(el.style.backgroundColor));
const isInlineCode = (el) => el.tagName === 'CODE' && !el.closest('pre');
// Põe o cursor logo depois do elemento: o que for digitado já sai sem aquele formato
const caretAfter = (el) => {
  const sel = window.getSelection();
  let next = el.nextSibling;
  if (!next || next.nodeType !== 3) {
    next = document.createTextNode('​');
    el.after(next);
  }
  const r = document.createRange();
  r.setStart(next, next.textContent.startsWith('​') ? 1 : 0);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
};
const unwrap = (el) => {
  const parent = el.parentNode;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
};
const placeCaret = (node, offset) => {
  const sel = window.getSelection();
  const r = document.createRange();
  r.setStart(node, offset);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
};
// Texto antes/depois do cursor dentro de um elemento
const textAround = (container) => {
  const sel = window.getSelection();
  const r = sel.getRangeAt(0);
  const before = document.createRange();
  before.selectNodeContents(container);
  before.setEnd(r.startContainer, r.startOffset);
  const after = document.createRange();
  after.selectNodeContents(container);
  after.setStart(r.endContainer, r.endOffset);
  // <br> conta como quebra de linha (o Chrome usa <br> dentro do bloco de código)
  const flat = (range) => {
    let out = '';
    const walk = (n) => {
      if (n.nodeType === 3) out += n.data;
      else if (n.nodeName === 'BR') out += '\n';
      else n.childNodes.forEach(walk);
    };
    range.cloneContents().childNodes.forEach(walk);
    return out;
  };
  return { before: flat(before), after: flat(after) };
};

export default function EditorPane({ store, openIds, activeId, onActivate, onCloseTab, onCloseAll, onOpen, onBackToMap, onDelete }) {
  const note = activeId ? store.byId.get(activeId) : null;

  return (
    <section className="nr-editor-pane">
      <div className="nr-tabs" role="tablist">
        {onBackToMap && (
          <button type="button" className="nr-back" onClick={onBackToMap} title="Voltar ao mapa">
            ← Mapa
          </button>
        )}
        {openIds.map((id) => {
          const n = store.byId.get(id);
          if (!n) return null;
          return (
            <div
              key={id}
              role="tab"
              aria-selected={id === activeId}
              className={`nr-tab ${id === activeId ? 'active' : ''}`}
              onClick={() => onActivate(id)}
              onAuxClick={(e) => e.button === 1 && onCloseTab(id)}
              title={n.title}
            >
              <i style={{ background: n.color || (n.tags?.[0] ? tagColor(n.tags[0]) : 'var(--foliage)') }} />
              <span>{n.title || 'Sem título'}</span>
              <button
                type="button"
                className="nr-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(id);
                }}
                aria-label="Fechar aba"
              >
                ×
              </button>
            </div>
          );
        })}
        {onCloseAll && (
          <button type="button" className="nr-window-close" onClick={onCloseAll} title="Fechar a janela (volta ao mapa)" aria-label="Fechar a janela">
            ✕
          </button>
        )}
      </div>

      {note ? (
        <NeuronEditor key={note.id} note={note} store={store} onOpen={onOpen} onDelete={onDelete} />
      ) : (
        <div className="empty nr-empty">Clique num neurônio do mapa para abrir aqui.</div>
      )}
    </section>
  );
}

export function NeuronEditor({ note, store, onOpen, onDelete, page = null, onClosePage, depth = 0 }) {
  // Numa página (+Pag), o texto editado é o da página; o "dono" continua sendo o neurônio
  const doc = page || note;
  const pages = note.pages || {};
  const update = (fields) => (page ? store.updatePage(note.id, page.id, fields) : store.updateNote(note.id, fields));
  const [openPage, setOpenPage] = useState(null);
  const editorRef = useRef(null);
  const saveTimer = useRef(null);
  const [tagDraft, setTagDraft] = useState('');
  const [block, setBlock] = useState('p');
  const [active, setActive] = useState({});
  const [suggest, setSuggest] = useState(null); // { query, x, y, index }
  const [linkBox, setLinkBox] = useState(null); // { url, range }
  const [hlColor, setHlColor] = useState(loadHl);
  const [hlPick, setHlPick] = useState(null); // { x, y } — cores do marca-texto
  const [hlAlpha, setHlAlpha] = useState(loadHlAlpha);
  const [textColor, setTextColor] = useState(loadTextColor);
  const [textPick, setTextPick] = useState(null); // { x, y } — cor do lápis
  const [fig, setFig] = useState(null); // foto selecionada: { el, x, y, w }
  const figMovingRef = useRef(false); // rolagem feita pelo ↑ ↓ não fecha a barra
  const [colorPick, setColorPick] = useState(null); // { kind: 'note' | 'tag', tag?, x, y }
  const imageInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [, setTick] = useState(0);

  // Carrega o texto uma vez por neurônio (preserva o cursor ao digitar)
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = doc.content || '';
    // Ligações mostram o título atual do neurônio citado
    el.querySelectorAll('a.wikilink').forEach((a) => {
      a.setAttribute('contenteditable', 'false');
      const target = store.byId.get(a.dataset.id);
      if (target) a.textContent = target.title || 'Sem título';
      a.classList.toggle('broken', !target);
    });
    syncPagelinks(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, store.rev]);

  // O mesmo texto aberto em outro lugar (mapa e editor de notas): quando ele muda
  // lá e este editor não está sendo usado, atualiza aqui também
  useEffect(() => {
    const el = editorRef.current;
    if (!el || saveTimer.current || el.contains(document.activeElement)) return;
    if (cleanHtml(el.innerHTML) === (doc.content || '')) return;
    el.innerHTML = doc.content || '';
    el.querySelectorAll('a.wikilink').forEach((a) => {
      a.setAttribute('contenteditable', 'false');
      const target = store.byId.get(a.dataset.id);
      if (target) a.textContent = target.title || 'Sem título';
      a.classList.toggle('broken', !target);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.content]);

  // Marcas +Pag: nome atual da página; as que viraram neurônio ([[ ]]) viram ligação
  const syncPagelinks = (el) => {
    let changed = false;
    el.querySelectorAll('a.pagelink').forEach((a) => {
      a.setAttribute('contenteditable', 'false');
      const pid = a.dataset.page;
      const promotedTo = note.promoted && note.promoted[pid];
      const target = promotedTo && store.byId.get(promotedTo);
      if (!pages[pid] && target) {
        a.outerHTML = wikilinkHtml(target);
        changed = true;
        return;
      }
      if (!pages[pid]) {
        // página excluída: a marca sai do texto
        a.remove();
        changed = true;
        return;
      }
      a.textContent = pages[pid].title || 'Página sem título';
    });
    return changed;
  };
  const pagesKey = Object.values(pages)
    .map((p) => `${p.id}:${p.title}`)
    .join('|');
  // Enter cria parágrafos de verdade (e não <div>), para os formatos saberem onde termina cada linha
  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* navegador sem suporte */
    }
  }, []);
  useEffect(() => {
    const el = editorRef.current;
    if (el && syncPagelinks(el)) save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey]);

  // Página aberta: o cursor vai direto para o texto dela
  useEffect(() => {
    if (!page) return undefined;
    const t = setTimeout(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }, 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Editado há X" se atualiza sozinho
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Salva ao sair (não perde o que estava pendente)
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        const el = editorRef.current;
        if (el) update({ content: cleanHtml(el.innerHTML) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const save = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      const el = editorRef.current;
      if (el) update({ content: cleanHtml(el.innerHTML) });
    }, 350);
  };

  const refreshState = () => {
    const el = editorRef.current;
    const b = el && currentBlock(el);
    // Dentro de citação/bloco de código, o formato é o do bloco de fora
    const outer = b && b.closest('blockquote, pre');
    const tag = outer && el.contains(outer) ? outer.tagName.toLowerCase() : b ? b.tagName.toLowerCase() : 'p';
    setBlock(BLOCKS.some(([v]) => v === tag) ? tag : 'p');
    const q = (c) => {
      try {
        return document.queryCommandState(c);
      } catch (e) {
        return false;
      }
    };
    setActive({
      bold: q('bold'),
      italic: q('italic'),
      underline: q('underline'),
      strikeThrough: q('strikeThrough'),
      insertUnorderedList: q('insertUnorderedList') && !(b && b.closest('ul.checklist')),
      insertOrderedList: q('insertOrderedList'),
      highlight: Boolean(el && inlineAncestor(el, isHighlight)),
      code: Boolean(el && inlineAncestor(el, isInlineCode)),
      checklist: Boolean(b && b.closest('ul.checklist'))
    });
  };

  const exec = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    refreshState();
    save();
  };

  // Tira o cursor de dentro de uma citação/bloco de código (a linha atual vira parágrafo)
  const leaveContainer = (container) => {
    const p = document.createElement('p');
    p.appendChild(document.createElement('br'));
    container.after(p);
    placeCaret(p, 0);
  };

  const formatBlock = (tag) => {
    const el = editorRef.current;
    el?.focus();
    const b = currentBlock(el);
    const outer = b && b.closest('blockquote, pre');
    const current = outer && el.contains(outer) ? outer.tagName.toLowerCase() : b ? b.tagName.toLowerCase() : 'p';
    // Clicar de novo no mesmo formato volta para parágrafo
    const target = current === tag ? 'p' : tag;
    if (outer && el.contains(outer) && target !== current) {
      // Sair da citação/código: antes o "Parágrafo" ficava preso dentro dela
      const text = outer.innerText.replace(/\n+$/, '');
      const lines = text.split('\n');
      const frag = document.createDocumentFragment();
      let last = null;
      lines.forEach((line) => {
        const node = document.createElement(target === 'blockquote' || target === 'pre' ? 'p' : target);
        if (line) node.textContent = line;
        else node.appendChild(document.createElement('br'));
        frag.appendChild(node);
        last = node;
      });
      outer.replaceWith(frag);
      if (last) placeCaret(last, last.childNodes.length);
      if (target === 'blockquote' || target === 'pre') document.execCommand('formatBlock', false, `<${target}>`);
    } else {
      document.execCommand('formatBlock', false, `<${target}>`);
    }
    refreshState();
    save();
  };

  // Marca-texto liga e desliga (antes só aplicava de novo)
  const toggleHighlight = () => {
    const el = editorRef.current;
    el?.focus();
    const sel = window.getSelection();
    const mark = inlineAncestor(el, isHighlight);
    if (mark) {
      if (sel && sel.isCollapsed) caretAfter(mark);
      else document.execCommand('hiliteColor', false, 'transparent');
    } else {
      document.execCommand('hiliteColor', false, withAlpha(hlColor, hlAlpha));
    }
    refreshState();
    save();
  };

  // Volta a seleção guardada (o seletor de cor/opacidade tira o foco do texto)
  const restoreRange = () => {
    const el = editorRef.current;
    el?.focus();
    const sel = window.getSelection();
    if (savedRangeRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    return sel;
  };

  // ---------- Cor do lápis (texto) ----------
  const paintText = (c) => {
    const sel = restoreRange();
    if (!sel || sel.rangeCount === 0) return;
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('foreColor', false, c);
    document.execCommand('styleWithCSS', false, false);
    if (sel.rangeCount) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    refreshState();
    save();
  };
  const pickTextColor = (c) => {
    setTextColor(c);
    try {
      localStorage.setItem(TEXT_KEY, c);
    } catch {
      /* só não lembra */
    }
    paintText(c);
  };
  // Tira a cor do texto selecionado (volta a cor normal do tema)
  const clearTextColor = () => {
    const sel = restoreRange();
    const el = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !el) return;
    const range = sel.getRangeAt(0);
    const inside = (n) => range.intersectsNode(n) || n.contains(range.startContainer);
    el.querySelectorAll('font[color], [style*="color"]').forEach((n) => {
      if (!inside(n)) return;
      if (n.tagName === 'FONT') n.removeAttribute('color');
      if (n.style) n.style.color = '';
      if (n.getAttribute('style') === '') n.removeAttribute('style');
      if ((n.tagName === 'FONT' || n.tagName === 'SPAN') && !n.attributes.length) unwrap(n);
    });
    refreshState();
    save();
  };

  // Nova cor do marca-texto: vale para o próximo uso e já pinta o que estiver selecionado
  const pickHighlight = (c, alpha = hlAlpha) => {
    setHlColor(c);
    setHlAlpha(alpha);
    try {
      localStorage.setItem(HL_KEY, c);
      localStorage.setItem(HL_ALPHA_KEY, String(alpha));
    } catch {
      /* só não lembra */
    }
    const el = editorRef.current;
    const sel = restoreRange();
    const paint = withAlpha(c, alpha);
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      document.execCommand('hiliteColor', false, paint);
      // guarda a seleção nova: mexer na opacidade depois repinta o mesmo trecho
      if (sel.rangeCount) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      save();
    } else {
      const mark = inlineAncestor(el, isHighlight);
      if (mark) {
        mark.style.backgroundColor = paint;
        save();
      }
    }
    refreshState();
  };

  // ---------- Imagens ----------
  const rememberRange = () => {
    const sel = window.getSelection();
    const el = editorRef.current;
    if (sel && sel.rangeCount && el && el.contains(sel.anchorNode)) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };
  const insertImages = async (files) => {
    const list = [...(files || [])].filter((f) => /^image\//.test(f.type));
    if (!list.length) return;
    const el = editorRef.current;
    el?.focus();
    const sel = window.getSelection();
    if (savedRangeRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    for (const file of list) {
      try {
        const src = await readImage(file);
        // Foto numa moldura: dá para pôr legenda, centralizar, mudar o tamanho e mover
        document.execCommand(
          'insertHTML',
          false,
          `<figure class="nr-fig" data-align="center" style="width: 70%"><img src="${src}" alt="${escapeHtml(file.name || 'imagem')}"></figure><p><br></p>`
        );
      } catch {
        /* arquivo que não é imagem: ignora */
      }
    }
    savedRangeRef.current = null;
    sfx.play('drop');
    save();
  };

  // Código na linha: liga e desliga. Sem texto selecionado, já começa a escrever dentro dele.
  const inlineCode = () => {
    const el = editorRef.current;
    el?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const code = inlineAncestor(el, isInlineCode);
    if (code) {
      if (sel.isCollapsed) caretAfter(code);
      else unwrap(code);
      refreshState();
      save();
      return;
    }
    const text = sel.toString();
    document.execCommand('insertHTML', false, `<code data-new="1">${text ? escapeHtml(text) : '​'}</code>`);
    const fresh = el.querySelector('code[data-new]');
    if (fresh) {
      fresh.removeAttribute('data-new');
      if (text) caretAfter(fresh);
      else placeCaret(fresh.firstChild || fresh, fresh.firstChild ? fresh.firstChild.textContent.length : 0);
    }
    refreshState();
    save();
  };

  const toggleChecklist = () => {
    editorRef.current?.focus();
    const b = currentBlock(editorRef.current);
    const list = b && b.closest('ul');
    if (list && list.classList.contains('checklist')) {
      // Desligar volta para texto normal (antes virava uma lista comum)
      list.classList.remove('checklist');
      list.querySelectorAll('li').forEach((li) => li.removeAttribute('data-checked'));
      document.execCommand('insertUnorderedList');
    } else {
      if (!list) document.execCommand('insertUnorderedList');
      const b2 = currentBlock(editorRef.current);
      const ul = b2 && b2.closest('ul');
      if (ul) {
        ul.classList.add('checklist');
        ul.querySelectorAll('li').forEach((li) => li.getAttribute('data-checked') || li.setAttribute('data-checked', 'false'));
      }
    }
    refreshState();
    save();
  };

  // ---------- [[ ligações ]] ----------
  const matches = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.trim().toLowerCase();
    const has = (t) => !q || (t || '').toLowerCase().includes(q);
    // páginas deste neurônio (menos a que está aberta)
    const pageItems = Object.values(pages)
      .filter((p) => p.id !== page?.id && has(p.title))
      .map((p) => ({ ...p, kind: 'page' }));
    if (suggest.kind === 'page') return pageItems.slice(0, 8);
    const neurons = store.notes.filter((n) => n.id !== note.id && has(n.title)).slice(0, 8);
    // [[ numa página: ela vira neurônio
    return [...neurons, ...pageItems.slice(0, 4)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggest, store.notes, note.id, pagesKey, page?.id]);

  const detectSuggest = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return setSuggest(null);
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) return setSuggest(null);
    const before = node.textContent.slice(0, sel.anchorOffset);
    const kind = TRIGGERS.page.test(before) ? 'page' : TRIGGERS.link.test(before) ? 'link' : null;
    if (!kind) return setSuggest(null);
    const m = before.match(TRIGGERS[kind]);
    const query = m[1] || '';
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const host = editorRef.current.closest('.nr-editor').getBoundingClientRect();
    // Perto do fim do painel, a lista abre para cima
    const up = rect.bottom + 260 > host.bottom;
    setSuggest((s) => ({
      kind,
      query,
      x: Math.min(rect.left - host.left, host.width - 240),
      y: up ? rect.top - host.top - 4 : rect.bottom - host.top + 4,
      up,
      index: s && s.query === query && s.kind === kind ? s.index : 0
    }));
    return undefined;
  };

  const chooseSuggestion = (target) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !suggest) return;
    const node = sel.anchorNode;
    const offset = sel.anchorOffset;
    const before = node.textContent.slice(0, offset);
    const m = before.match(TRIGGERS[suggest.kind]);
    if (!m) return;
    const query = (m[1] || '').trim();
    const range = document.createRange();
    range.setStart(node, offset - m[0].length);
    range.setEnd(node, offset);
    sel.removeAllRanges();
    sel.addRange(range);

    if (suggest.kind === 'page') {
      // +Pag: página nova (ou uma que já existe) e abre ela por cima
      const pg = target || store.addPage(note.id, { title: query || 'Nova página' });
      document.execCommand('insertHTML', false, `${pagelinkHtml(pg)}&nbsp;`);
      setSuggest(null);
      save();
      sfx.play('folder');
      setOpenPage(pg.id);
      return;
    }

    let linked = target;
    if (target && target.kind === 'page') {
      // [[ numa página: ela sai daqui de dentro e vira um neurônio no mapa
      linked = store.promotePage(note.id, target.id);
      if (editorRef.current) {
        editorRef.current.querySelectorAll(`a.pagelink[data-page="${target.id}"]`).forEach((a) => {
          a.outerHTML = wikilinkHtml(linked);
        });
      }
      if (openPage === target.id) setOpenPage(null);
    }
    if (!linked) linked = store.addNote({ title: query || 'Novo neurônio', tags: [] });
    document.execCommand('insertHTML', false, `${wikilinkHtml(linked)}&nbsp;`);
    sfx.play('branch');
    setSuggest(null);
    save();
  };

  const startLink = () => {
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    setLinkBox({ url: 'https://', range });
  };

  const applyLink = () => {
    if (!linkBox) return;
    const url = linkBox.url.trim();
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (linkBox.range) {
      sel.removeAllRanges();
      sel.addRange(linkBox.range);
    }
    if (url && !/^javascript:/i.test(url)) {
      if (sel.isCollapsed) document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`);
      else document.execCommand('createLink', false, url);
      editorRef.current.querySelectorAll('a[href]:not(.wikilink)').forEach((a) => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      });
    }
    setLinkBox(null);
    save();
  };

  // ---------- Teclas dentro do editor ----------
  const onKeyDown = (e) => {
    if (suggest) {
      const total = matches.length + 1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setSuggest((s) => ({ ...s, index: (s.index + d + total) % total }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        chooseSuggestion(matches[suggest.index] || null);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSuggest(null);
        return;
      }
    }

    // Enter na legenda da foto: vai para a linha de baixo da foto
    if (e.key === 'Enter' && !e.shiftKey) {
      const cap = inlineAncestor(editorRef.current, (n) => n.tagName === 'FIGCAPTION');
      if (cap) {
        e.preventDefault();
        const f = cap.closest('figure');
        let next = f.nextElementSibling;
        if (!next || next.tagName !== 'P') {
          next = document.createElement('p');
          next.appendChild(document.createElement('br'));
          f.after(next);
        }
        placeCaret(next, 0);
        setFig(null);
        save();
        return;
      }
    }

    // Esc dentro de código/marca-texto: para de escrever com esse formato
    if (e.key === 'Escape') {
      const el = editorRef.current;
      const sticky = inlineAncestor(el, isInlineCode) || inlineAncestor(el, isHighlight);
      const sel = window.getSelection();
      if (sticky && sel && sel.isCollapsed) {
        e.preventDefault();
        e.stopPropagation();
        caretAfter(sticky);
        refreshState();
        return;
      }
    }

    // Enter numa linha vazia de citação ou bloco de código: sai dele (como nas listas)
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const el = editorRef.current;
      const b = currentBlock(el);
      const outer = b && b.closest('blockquote, pre');
      const sel = window.getSelection();
      if (outer && el.contains(outer) && sel && sel.isCollapsed && b === outer && !outer.textContent.replace(/[​\n]/g, '').trim()) {
        // Citação/código vazio (o Chrome cria um novo a cada Enter): vira parágrafo normal
        e.preventDefault();
        const p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        outer.replaceWith(p);
        placeCaret(p, 0);
        refreshState();
        save();
        return;
      }
      if (outer && el.contains(outer) && sel && sel.isCollapsed) {
        const { before, after } = textAround(outer);
        const lineBefore = before.split('\n').pop().replace(/​/g, '');
        const lineAfter = after.split('\n')[0].replace(/​/g, '');
        const childEmpty = b !== outer && !b.textContent.replace(/​/g, '').trim();
        const atEnd = !after.replace(/[\n​]/g, '').length;
        if (atEnd && (childEmpty || (!lineBefore && !lineAfter && before.length > 0))) {
          e.preventDefault();
          if (childEmpty) b.remove();
          else {
            // tira a linha vazia do fim
            const last = outer.lastChild;
            if (last && last.nodeType === 1 && last.tagName === 'BR') last.remove();
            else if (last && last.nodeType === 3) last.textContent = last.textContent.replace(/\n$/, '');
            if (outer.lastChild && outer.lastChild.nodeType === 1 && outer.lastChild.tagName === 'BR' && outer.childNodes.length > 1) outer.lastChild.remove();
          }
          leaveContainer(outer);
          refreshState();
          save();
          return;
        }
      }
    }

    if (e.key === 'Escape' && page && onClosePage) {
      e.preventDefault();
      e.stopPropagation();
      onClosePage();
      return;
    }

    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      startLink();
      return;
    }
    if (mod && e.key === 'Enter') {
      // Ctrl+Enter marca/desmarca a caixa do item
      const li = currentBlock(editorRef.current);
      if (li && li.tagName === 'LI' && li.parentElement.classList.contains('checklist')) {
        e.preventDefault();
        li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
        save();
      }
      return;
    }


    if (e.key === 'Enter' && !mod) {
      // Item novo de checklist começa desmarcado
      setTimeout(() => {
        const li = currentBlock(editorRef.current);
        if (li && li.tagName === 'LI' && li.parentElement.classList.contains('checklist') && !li.textContent.trim()) {
          li.setAttribute('data-checked', 'false');
        }
      }, 0);
    }
  };

  // Atalhos estilo Markdown no começo da linha: "# ", "## ", "- ", "1. ", "> ", "[] "
  const markdownShortcut = () => {
    const sel = window.getSelection();
    const node = sel && sel.anchorNode;
    if (!node || node.nodeType !== 3 || !sel.isCollapsed) return false;
    const typed = node.textContent.slice(0, sel.anchorOffset).replace(/\u00a0/g, ' ');
    if (!typed.endsWith(' ')) return false;
    const before = typed.slice(0, -1);
    const b = currentBlock(editorRef.current);
    const blockText = (b ? b.textContent : node.textContent).replace(/\u00a0/g, ' ');
    if (!blockText.startsWith(typed)) return false;
    const map = { '#': 'h1', '##': 'h2', '###': 'h3', '>': 'blockquote', '```': 'pre' };
    const kind = map[before]
      ? 'block'
      : ['-', '*'].includes(before)
      ? 'ul'
      : before === '1.'
      ? 'ol'
      : ['[]', '[ ]'].includes(before)
      ? 'check'
      : null;
    if (!kind) return false;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, sel.anchorOffset);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('delete');
    // Dentro de uma lista, o título/citação sai da lista primeiro
    const inList = currentBlock(editorRef.current)?.tagName === 'LI';
    if (kind === 'block') {
      if (inList) document.execCommand('outdent');
      document.execCommand('formatBlock', false, `<${map[before]}>`);
    } else if (kind === 'ul') {
      if (!inList) document.execCommand('insertUnorderedList');
    } else if (kind === 'ol') {
      if (inList) document.execCommand('outdent');
      document.execCommand('insertOrderedList');
    } else toggleChecklist();
    refreshState();
    return true;
  };

  // ---------- Foto selecionada (barra de opções em cima dela) ----------
  const figOf = (img) => {
    let f = img.closest('figure');
    if (!f) {
      // fotos antigas (sem moldura) ganham uma
      f = document.createElement('figure');
      f.className = 'nr-fig';
      f.dataset.align = 'center';
      f.style.width = '70%';
      img.replaceWith(f);
      f.appendChild(img);
    }
    return f;
  };
  // A barra da foto some ao rolar (senão ficaria solta na tela)
  useEffect(() => {
    if (!fig) return undefined;
    const close = () => {
      if (!figMovingRef.current) setFig(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [fig]);
  const placeFig = (f) => {
    const r = f.getBoundingClientRect();
    setFig({ el: f, x: r.left + r.width / 2, y: r.top, bottom: r.bottom });
  };
  const figAction = (action, value) => {
    if (!fig) return;
    const f = fig.el;
    if (action === 'align') f.dataset.align = value;
    else if (action === 'size') {
      f.style.width = `${Math.max(15, Math.min(100, value))}%`;
    } else if (action === 'grow') {
      const now = parseInt(f.style.width, 10) || 70;
      f.style.width = `${Math.max(15, Math.min(100, now + value))}%`;
    } else if (action === 'caption') {
      let cap = f.querySelector('figcaption');
      if (cap) cap.remove();
      else {
        cap = document.createElement('figcaption');
        cap.textContent = 'Escreva uma legenda';
        f.appendChild(cap);
        // já seleciona o texto para trocar
        const r = document.createRange();
        r.selectNodeContents(cap);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
    } else if (action === 'up' || action === 'down') {
      const sib = action === 'up' ? f.previousElementSibling : f.nextElementSibling;
      if (sib) {
        if (action === 'up') sib.before(f);
        else sib.after(f);
      }
    } else if (action === 'delete') {
      f.remove();
      setFig(null);
      sfx.play('delete');
      save();
      return;
    }
    sfx.play('tick');
    save();
    if (action === 'up' || action === 'down') {
      // rola até a foto e a barra vai junto (a rolagem fecha a barra, então reabre depois)
      figMovingRef.current = true;
      f.scrollIntoView({ block: 'nearest' });
      setTimeout(() => {
        figMovingRef.current = false;
        placeFig(f);
      }, 150);
    } else requestAnimationFrame(() => placeFig(f));
  };

  const onEditorClick = (e) => {
    const img = e.target.closest('img');
    if (img && editorRef.current?.contains(img)) {
      const f = figOf(img);
      placeFig(f);
      return;
    }
    if (!e.target.closest('figure')) setFig(null);
    const pl = e.target.closest('a.pagelink');
    if (pl) {
      e.preventDefault();
      if (pages[pl.dataset.page]) {
        sfx.play('open');
        setOpenPage(pl.dataset.page);
      }
      return;
    }
    const wl = e.target.closest('a.wikilink');
    if (wl) {
      e.preventDefault();
      if (store.byId.has(wl.dataset.id)) onOpen(wl.dataset.id, e.ctrlKey || e.metaKey);
      return;
    }
    const a = e.target.closest('a[href]');
    if (a && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      window.open(a.href, '_blank', 'noopener');
      return;
    }
    // Caixinha do checklist (clique à esquerda do item)
    const li = e.target.closest('ul.checklist > li');
    if (li) {
      const r = li.getBoundingClientRect();
      if (e.clientX - r.left < 24) {
        e.preventDefault();
        li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
        save();
      }
    }
    refreshState();
  };

  const onPaste = (e) => {
    // Imagem copiada (print, foto...): entra como imagem
    const imgs = [...(e.clipboardData.files || [])].filter((f) => /^image\//.test(f.type));
    if (imgs.length) {
      e.preventDefault();
      rememberRange();
      insertImages(imgs);
      return;
    }
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    e.preventDefault();
    if (html) {
      // Tira estilos de sites (fonte, cores, tamanhos) e mantém a estrutura
      const clean = cleanHtml(html).replace(/\s(style|class|id|width|height)="[^"]*"/gi, '');
      document.execCommand('insertHTML', false, clean);
    } else {
      document.execCommand('insertText', false, text);
    }
    save();
  };

  // ---------- Tags ----------
  const addTag = (raw) => {
    const t = normalizeTag(raw);
    if (!t || (note.tags || []).includes(t)) return setTagDraft('');
    store.updateNote(note.id, { tags: [...(note.tags || []), t] });
    sfx.play('tick');
    setTagDraft('');
    return undefined;
  };
  const removeTag = (t) => {
    sfx.play('tick');
    store.updateNote(note.id, { tags: (note.tags || []).filter((x) => x !== t) });
  };

  // ---------- Rodapé ----------
  const text = plainText(doc.content);
  const words = text ? text.split(/\s+/).length : 0;
  const pageList = Object.values(pages);
  // Excluir uma página (as páginas dentro dela vão junto)
  const removePage = async (pg) => {
    const inner = pagesIn(pg.content).filter((pid) => pages[pid]).length;
    const ok = await ask({
      icon: '📄',
      title: `Excluir a página “${pg.title || 'Página sem título'}”?`,
      message: inner ? `As ${inner} página(s) dentro dela também saem.` : 'O texto dela será apagado.',
      yes: 'Excluir',
      no: 'Cancelar',
      danger: true
    });
    if (!ok) return;
    if (page && page.id === pg.id && onClosePage) onClosePage();
    if (openPage === pg.id) setOpenPage(null);
    store.deletePage(note.id, pg.id);
    sfx.play('delete');
  };
  const outgoing = linksIn(note.content).filter((id) => store.byId.has(id));
  const incoming = [...(store.backlinks.get(note.id) || [])];
  const tagSuggestions = store.tags.map((t) => t.tag).filter((t) => !(note.tags || []).includes(t));

  return (
    <div className={`nr-editor ${page ? 'is-page' : ''}`}>
      {page && (
        <div className="nr-page-bar">
          <span>
            📄 Página dentro de “{note.title || 'Sem título'}”
          </span>
          <span className="nr-page-actions">
            <button type="button" className="nr-page-delete" onClick={() => removePage(page)} title="Excluir esta página">
              🗑 Excluir
            </button>
            <button type="button" className="nr-page-close" onClick={onClosePage} title="Fechar página (Esc)" aria-label="Fechar página">
              ×
            </button>
          </span>
        </div>
      )}
      <div className="nr-note-head">
        {!page && (
          <button
            type="button"
            className="nr-color-btn"
            style={{ background: note.color || (note.tags?.[0] ? tagColor(note.tags[0]) : 'var(--foliage)') }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setColorPick({ kind: 'note', x: r.left, y: r.bottom + 6 });
            }}
            title="Cor do neurônio"
            aria-label="Cor do neurônio"
          />
        )}
        <input
          className="title-input nr-title"
          value={doc.title}
          placeholder={page ? 'Título da página' : 'Título do neurônio'}
          maxLength={120}
          onChange={(e) => update({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              editorRef.current?.focus();
            }
          }}
        />
        {!page && (
        <div className="nr-note-actions">
          <button
            type="button"
            className="tool danger"
            onClick={async () => {
              const ok = await ask({
                title: 'Excluir este neurônio?',
                message: `“${note.title || 'Sem título'}” será apagado. As ligações para ele ficam marcadas como quebradas.`,
                yes: 'Excluir',
                danger: true
              });
              if (ok) onDelete(note);
            }}
            title="Excluir neurônio"
          >
            🗑
          </button>
        </div>
        )}
      </div>

      {/* Tags */}
      {!page && (
      <div className="nr-tags-row">
        {(note.tags || []).map((t) => (
          <span key={t} className="nr-tag" style={{ '--tag': tagColor(t) }}>
            <button
              type="button"
              className="nr-tag-name"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setColorPick({ kind: 'tag', tag: t, x: r.left, y: r.bottom + 6 });
              }}
              title="Mudar a cor desta tag"
            >
              #{t}
            </button>
            <button type="button" onClick={() => removeTag(t)} aria-label={`Remover tag ${t}`}>
              ×
            </button>
          </span>
        ))}
        <input
          className="nr-tag-input"
          list={`nr-tags-${note.id}`}
          placeholder="+ tag"
          value={tagDraft}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,\s]$/.test(v)) addTag(v);
            else setTagDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(tagDraft);
            } else if (e.key === 'Backspace' && !tagDraft && (note.tags || []).length) {
              removeTag(note.tags[note.tags.length - 1]);
            }
          }}
          onBlur={() => tagDraft && addTag(tagDraft)}
        />
        <datalist id={`nr-tags-${note.id}`}>
          {tagSuggestions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        {/* Ligação com uma habilidade, ao lado das tags */}
        <SkillLink
          value={note.skillId || null}
          onChange={(skillId) => {
            sfx.play(skillId ? 'branch' : 'tick');
            store.updateNote(note.id, { skillId: skillId || null });
          }}
        />
      </div>
      )}

      {/* Barra de formatação */}
      <div className="editor-wrap nr-editor-wrap">
        <div className="toolbar nr-toolbar" onMouseDown={(e) => e.target.closest('button') && e.preventDefault()}>
          <select className="tool" value={block} onChange={(e) => formatBlock(e.target.value)} title="Estilo do bloco">
            {BLOCKS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <span className="toolbar-sep" />
          <button type="button" className={`tool ${active.bold ? 'active' : ''}`} onClick={() => exec('bold')} title="Negrito (Ctrl+B)">
            <b>N</b>
          </button>
          <button type="button" className={`tool ${active.italic ? 'active' : ''}`} onClick={() => exec('italic')} title="Itálico (Ctrl+I)">
            <i>I</i>
          </button>
          <button type="button" className={`tool ${active.underline ? 'active' : ''}`} onClick={() => exec('underline')} title="Sublinhado (Ctrl+U)">
            <u>S</u>
          </button>
          <button type="button" className={`tool ${active.strikeThrough ? 'active' : ''}`} onClick={() => exec('strikeThrough')} title="Riscado">
            <s>R</s>
          </button>
          <button
            type="button"
            className="tool"
            onClick={() => {
              rememberRange();
              paintText(textColor);
            }}
            title="Cor do lápis (cor do texto)"
          >
            <span className="nr-hl-icon">
              ✏️<i style={{ background: textColor }} />
            </span>
          </button>
          <button
            type="button"
            className="tool nr-hl-more"
            onClick={(e) => {
              rememberRange();
              const r = e.currentTarget.getBoundingClientRect();
              setTextPick({ x: r.left - 60, y: r.bottom + 6 });
            }}
            title="Escolher a cor do lápis"
            aria-label="Escolher a cor do lápis"
          >
            ▾
          </button>
          <button type="button" className={`tool ${active.highlight ? 'active' : ''}`} onClick={toggleHighlight} title="Marca-texto (clique de novo ou Esc para parar)">
            <span className="nr-hl-icon">
              🖍<i style={{ background: withAlpha(hlColor, Math.max(0.35, hlAlpha)) }} />
            </span>
          </button>
          <button
            type="button"
            className="tool nr-hl-more"
            onClick={(e) => {
              rememberRange();
              const r = e.currentTarget.getBoundingClientRect();
              setHlPick({ x: r.left - 60, y: r.bottom + 6 });
            }}
            title="Cor do marca-texto"
            aria-label="Cor do marca-texto"
          >
            ▾
          </button>
          <button type="button" className={`tool ${active.code ? 'active' : ''}`} onClick={inlineCode} title="Código (clique de novo ou Esc para parar)">
            {'</>'}
          </button>
          <span className="toolbar-sep" />
          <button type="button" className={`tool ${active.insertUnorderedList ? 'active' : ''}`} onClick={() => exec('insertUnorderedList')} title="Lista">
            • ≡
          </button>
          <button type="button" className={`tool ${active.insertOrderedList ? 'active' : ''}`} onClick={() => exec('insertOrderedList')} title="Lista numerada">
            1.≡
          </button>
          <button type="button" className={`tool ${active.checklist ? 'active' : ''}`} onClick={toggleChecklist} title="Lista de tarefas">
            ☑
          </button>
          <span className="toolbar-sep" />
          <button type="button" className="tool" onClick={startLink} title="Link (Ctrl+K)">
            🔗
          </button>
          <button
            type="button"
            className="tool"
            onClick={() => {
              exec('insertText', '[[');
              setTimeout(detectSuggest, 0);
            }}
            title="Ligar a outro neurônio ([[)"
          >
            [[ ]]
          </button>
          <button
            type="button"
            className="tool"
            onClick={() => {
              rememberRange();
              imageInputRef.current?.click();
            }}
            title="Inserir imagem (também dá para colar ou arrastar)"
          >
            🖼
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              insertImages(e.target.files);
              e.target.value = '';
            }}
          />
          <button type="button" className="tool" onClick={() => exec('insertHorizontalRule')} title="Linha divisória">
            ―
          </button>
          <span className="toolbar-sep" />
          <button type="button" className="tool" onClick={() => exec('justifyLeft')} title="Alinhar à esquerda">
            ⫷
          </button>
          <button type="button" className="tool" onClick={() => exec('justifyCenter')} title="Centralizar">
            ≡
          </button>
          <button type="button" className="tool" onClick={() => exec('removeFormat')} title="Limpar formatação">
            ⌫
          </button>
        </div>

        {hlPick && (
          <ColorPicker
            x={hlPick.x}
            y={hlPick.y}
            title="Cor do marca-texto"
            value={hlColor}
            colors={HIGHLIGHT_COLORS}
            alpha={hlAlpha}
            onPick={(c) => pickHighlight(c, hlAlpha)}
            extra={
              <label className="nr-alpha">
                <span>
                  Opacidade <b>{Math.round(hlAlpha * 100)}%</b>
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={hlAlpha}
                  onChange={(e) => pickHighlight(hlColor, Number(e.target.value))}
                />
              </label>
            }
            onClose={() => setHlPick(null)}
          />
        )}
        {textPick && (
          <ColorPicker
            x={textPick.x}
            y={textPick.y}
            title="Cor do lápis"
            value={textColor}
            colors={TEXT_COLORS}
            onPick={(c) => pickTextColor(c)}
            onReset={() => {
              clearTextColor();
              setTextPick(null);
            }}
            resetLabel="Cor normal"
            onClose={() => setTextPick(null)}
          />
        )}
        {fig && fig.el.isConnected && (
          <div
            className="nr-fig-bar"
            style={{ left: Math.max(8, Math.min(fig.x - 200, window.innerWidth - 408)), top: Math.max(8, fig.y - 44) }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <button type="button" title="Alinhar à esquerda" className={fig.el.dataset.align === 'left' ? 'on' : ''} onClick={() => figAction('align', 'left')}>
              ⫷
            </button>
            <button type="button" title="Centralizar" className={fig.el.dataset.align === 'center' ? 'on' : ''} onClick={() => figAction('align', 'center')}>
              ≡
            </button>
            <button type="button" title="Alinhar à direita" className={fig.el.dataset.align === 'right' ? 'on' : ''} onClick={() => figAction('align', 'right')}>
              ⫸
            </button>
            <span className="nr-fig-sep" />
            <button type="button" title="Diminuir" onClick={() => figAction('grow', -10)}>
              −
            </button>
            <span className="nr-fig-size">{parseInt(fig.el.style.width, 10) || 70}%</span>
            <button type="button" title="Aumentar" onClick={() => figAction('grow', 10)}>
              ＋
            </button>
            {[25, 50, 100].map((v) => (
              <button key={v} type="button" title={`${v}% da largura`} onClick={() => figAction('size', v)}>
                {v}%
              </button>
            ))}
            <span className="nr-fig-sep" />
            <button type="button" title="Legenda" className={fig.el.querySelector('figcaption') ? 'on' : ''} onClick={() => figAction('caption')}>
              💬 Legenda
            </button>
            <button type="button" title="Mover para cima" onClick={() => figAction('up')}>
              ↑
            </button>
            <button type="button" title="Mover para baixo" onClick={() => figAction('down')}>
              ↓
            </button>
            <button type="button" title="Excluir a foto" className="danger" onClick={() => figAction('delete')}>
              🗑
            </button>
          </div>
        )}
        {colorPick && (
          <ColorPicker
            x={colorPick.x}
            y={colorPick.y}
            title={colorPick.kind === 'tag' ? `Cor da tag #${colorPick.tag}` : 'Cor do neurônio'}
            value={colorPick.kind === 'tag' ? tagColor(colorPick.tag) : note.color}
            onPick={(c) => {
              sfx.play('tick');
              if (colorPick.kind === 'tag') store.setTagColor(colorPick.tag, c);
              else store.updateNote(note.id, { color: c });
            }}
            onReset={
              colorPick.kind === 'tag'
                ? () => {
                    sfx.play('tick');
                    store.setTagColor(colorPick.tag, null);
                    setColorPick(null);
                  }
                : () => {
                    sfx.play('tick');
                    store.updateNote(note.id, { color: null });
                    setColorPick(null);
                  }
            }
            resetLabel={colorPick.kind === 'tag' ? 'Cor automática' : 'Cor da tag'}
            onClose={() => setColorPick(null)}
          />
        )}

        {linkBox && (
          <div className="nr-linkbox">
            <input
              className="search-input"
              autoFocus
              value={linkBox.url}
              onChange={(e) => setLinkBox((l) => ({ ...l, url: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyLink();
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setLinkBox(null);
                }
              }}
            />
            <button type="button" className="btn small btn-primary" onClick={applyLink}>
              Aplicar
            </button>
            <button type="button" className="btn small" onClick={() => setLinkBox(null)}>
              Cancelar
            </button>
          </div>
        )}

        <div
          ref={editorRef}
          className="editor nr-text"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          data-placeholder={page ? 'Escreva a página… use +Pag para outra página dentro dela' : 'Escreva aqui… use [[ para ligar a outro neurônio, +Pag para criar uma página'}
          onInput={(e) => {
            const ne = e.nativeEvent;
            if (ne && ne.inputType === 'insertText' && ne.data && ne.data.endsWith(' ')) markdownShortcut();
            save();
            detectSuggest();
          }}
          onKeyDown={onKeyDown}
          onKeyUp={refreshState}
          onMouseUp={refreshState}
          onClick={onEditorClick}
          onPaste={onPaste}
          onDragOver={(e) => {
            if ([...(e.dataTransfer.items || [])].some((it) => it.kind === 'file')) e.preventDefault();
          }}
          onDrop={(e) => {
            const files = [...(e.dataTransfer.files || [])].filter((f) => /^image\//.test(f.type));
            if (!files.length) return;
            e.preventDefault();
            // coloca o cursor onde a imagem foi solta
            const pos = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
            if (pos) savedRangeRef.current = pos;
            insertImages(files);
          }}
          onBlur={() => setTimeout(() => setSuggest(null), 150)}
        />

      </div>

      {suggest && (
          <div className="menu nr-suggest" style={{ left: Math.max(8, suggest.x), top: suggest.y, transform: suggest.up ? 'translateY(-100%)' : undefined }}>
            {matches.map((n, i) => (
              <button
                key={`${n.kind || 'n'}-${n.id}`}
                type="button"
                className={`${i === suggest.index ? 'active' : ''} ${n.kind === 'page' ? 'is-page' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  chooseSuggestion(n);
                }}
                title={n.kind === 'page' && suggest.kind === 'link' ? 'Ligar com [[ ]] transforma esta página num neurônio' : undefined}
              >
                {n.kind === 'page' ? <span className="nr-suggest-page">📄</span> : <i style={{ background: n.color || (n.tags?.[0] ? tagColor(n.tags[0]) : 'var(--foliage)') }} />}
                {n.title}
                {n.kind === 'page' && suggest.kind === 'link' && <small> · vira neurônio</small>}
              </button>
            ))}
            <button
              type="button"
              className={suggest.index === matches.length ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                chooseSuggestion(null);
              }}
            >
              {suggest.kind === 'page'
                ? `＋ Criar página “${suggest.query.trim() || 'Nova página'}”`
                : `＋ Criar “${suggest.query.trim() || 'Novo neurônio'}”`}
            </button>
          </div>
        )}

      {/* Ligações e dados */}
      <div className="nr-footer">
        {!page && pageList.length > 0 && (
          <div className="nr-links">
            <span className="nr-links-title">Páginas ({pageList.length})</span>
            {pageList.map((p) => (
              <span key={p.id} className="nr-link-chip is-page nr-page-chip">
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('open');
                    setOpenPage(p.id);
                  }}
                  title="Abrir a página"
                >
                  📄 {p.title || 'Página sem título'}
                </button>
                <button type="button" className="nr-page-chip-x" onClick={() => removePage(p)} title="Excluir a página" aria-label="Excluir a página">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {!page && (
        <>
        <div className="nr-links">
          <span className="nr-links-title">Mencionado em ({incoming.length})</span>
          {incoming.length === 0 && <span className="muted small">Nenhum neurônio cita este ainda.</span>}
          {incoming.map((id) => (
            <button key={id} type="button" className="nr-link-chip" onClick={(e) => onOpen(id, e.ctrlKey || e.metaKey)}>
              ← {store.byId.get(id)?.title}
            </button>
          ))}
        </div>
        {outgoing.length > 0 && (
          <div className="nr-links">
            <span className="nr-links-title">Liga para ({outgoing.length})</span>
            {outgoing.map((id) => (
              <button key={id} type="button" className="nr-link-chip" onClick={(e) => onOpen(id, e.ctrlKey || e.metaKey)}>
                → {store.byId.get(id)?.title}
              </button>
            ))}
          </div>
        )}
        </>
        )}
        <div className="nr-meta small muted">
          {words} {words === 1 ? 'palavra' : 'palavras'} · {text.length} caracteres · editado {timeAgo(doc.updatedAt)}
        </div>
      </div>

      {/* Página aberta: uma janela dentro desta janela */}
      {openPage && pages[openPage] && (
        <div className="nr-page-window" style={{ '--depth': depth + 1 }}>
          <NeuronEditor
            key={openPage}
            note={note}
            store={store}
            onOpen={onOpen}
            onDelete={onDelete}
            page={pages[openPage]}
            depth={depth + 1}
            onClosePage={() => {
              sfx.play('close');
              setOpenPage(null);
              setTimeout(() => editorRef.current?.focus(), 0);
            }}
          />
        </div>
      )}
    </div>
  );
}
