import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ask } from '../../shared/Dialog.jsx';
import SkillLink from '../../shared/SkillLink.jsx';
import { sfx } from '../arvore/lib/sound.js';
import { cleanHtml, escapeHtml, linksIn, normalizeTag, pagelinkHtml, pagesIn, plainText, tagColor, wikilinkHtml } from './store.js';

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

export default function EditorPane({ store, openIds, activeId, onActivate, onCloseTab, onOpen, onBackToMap, onDelete }) {
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
              <i style={{ background: n.tags?.[0] ? tagColor(n.tags[0]) : 'var(--foliage)' }} />
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
      </div>

      {note ? (
        <NeuronEditor key={note.id} note={note} store={store} onOpen={onOpen} onDelete={onDelete} />
      ) : (
        <div className="empty nr-empty">Clique num neurônio do mapa para abrir aqui.</div>
      )}
    </section>
  );
}

function NeuronEditor({ note, store, onOpen, onDelete, page = null, onClosePage, depth = 0 }) {
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
  }, [doc.id]);

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
    const tag = b ? b.tagName.toLowerCase() : 'p';
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
      insertUnorderedList: q('insertUnorderedList'),
      insertOrderedList: q('insertOrderedList')
    });
  };

  const exec = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    refreshState();
    save();
  };

  const formatBlock = (tag) => {
    editorRef.current?.focus();
    const b = currentBlock(editorRef.current);
    // Clicar de novo no mesmo formato volta para parágrafo
    const target = b && b.tagName.toLowerCase() === tag ? 'p' : tag;
    document.execCommand('formatBlock', false, `<${target}>`);
    refreshState();
    save();
  };

  const inlineCode = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const text = sel.toString();
    exec('insertHTML', `<code>${escapeHtml(text || 'código')}</code>&#8203;`);
  };

  const toggleChecklist = () => {
    editorRef.current?.focus();
    const b = currentBlock(editorRef.current);
    const list = b && b.closest('ul');
    if (list && list.classList.contains('checklist')) {
      list.classList.remove('checklist');
      list.querySelectorAll('li').forEach((li) => li.removeAttribute('data-checked'));
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

  const onEditorClick = (e) => {
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
            #{t}
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
          <button type="button" className="tool" onClick={() => exec('hiliteColor', '#f6e7a1')} title="Marca-texto">
            🖍
          </button>
          <button type="button" className="tool" onClick={inlineCode} title="Código">
            {'</>'}
          </button>
          <span className="toolbar-sep" />
          <button type="button" className={`tool ${active.insertUnorderedList ? 'active' : ''}`} onClick={() => exec('insertUnorderedList')} title="Lista">
            • ≡
          </button>
          <button type="button" className={`tool ${active.insertOrderedList ? 'active' : ''}`} onClick={() => exec('insertOrderedList')} title="Lista numerada">
            1.≡
          </button>
          <button type="button" className="tool" onClick={toggleChecklist} title="Lista de tarefas">
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
