// =========================================================
// NEURÔNIOS — dados (notas, tags e ligações [[ ]])
// Cada neurônio é uma nota em HTML. As ligações entre neurônios
// ficam no próprio texto como <a class="wikilink" data-id="...">.
// =========================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeHtml } from '../arvore/lib/html.js';
import { profileKey, readProfileRaw } from '../../atualizacao2_0/ProfileStorage.js';
import { getActiveProfileId } from '../../shared/activeProfile.js';

export const STORAGE_KEY = 'neuronios-v1';
export const THEME_KEY = 'eu-sou-arvore-theme'; // mesmo tema da Árvore

// Cores pastel da Árvore, usadas para as tags
export const TAG_COLORS = ['#7d9bb8', '#e8a0a0', '#7fa889', '#f2b880', '#b9a3d1', '#a9d8e8', '#e8c5a0', '#b8ddb5', '#f6e7a1'];

export const uid = () => `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
export const tagColor = (tag) => TAG_COLORS[hash(String(tag || '')) % TAG_COLORS.length];

export const normalizeTag = (t) =>
  String(t || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40);

// Ids de neurônios citados no texto
export const linksIn = (html) => {
  const out = new Set();
  const re = /data-id="([^"]+)"/g;
  let m;
  while ((m = re.exec(html || ''))) out.add(m[1]);
  return [...out];
};

export const plainText = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
};

export const escapeHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const wikilinkHtml = (note) =>
  `<a class="wikilink" data-id="${escapeHtml(note.id)}" contenteditable="false">${escapeHtml(note.title || 'Sem título')}</a>`;

// +Pag: página de texto dentro de um neurônio (não aparece no mapa)
export const pagelinkHtml = (page) =>
  `<a class="pagelink" data-page="${escapeHtml(page.id)}" contenteditable="false">${escapeHtml(page.title || 'Página sem título')}</a>`;

// Ids de páginas citadas num texto
export const pagesIn = (html) => {
  const out = new Set();
  const re = /data-page="([^"]+)"/g;
  let m;
  while ((m = re.exec(html || ''))) out.add(m[1]);
  return [...out];
};

// Texto do neurônio + das páginas dele (as ligações [[ ]] das páginas contam no mapa)
export const fullContent = (note) =>
  [note.content || '', ...Object.values(note.pages || {}).map((p) => p.content || '')].join('\n');

// Mantém as ligações e checklists, remove o perigoso
export const cleanHtml = (html) => sanitizeHtml(html);

// ---------- Neurônios de exemplo (primeira vez) ----------
const starter = () => {
  const now = new Date().toISOString();
  const ids = { boas: uid(), calma: uid() };
  const link = (id, title) => `<a class="wikilink" data-id="${id}" contenteditable="false">${title}</a>`;
  const n = (id, title, tags, content, x, y) => ({ id, title, tags, content, createdAt: now, updatedAt: now, x, y });
  return [
    n(
      ids.boas,
      'Bem-vindo aos Neurônios',
      ['inicio'],
      `<h2>Seu mapa de ideias</h2><p>Cada bolinha do mapa é um <b>neurônio</b>: uma nota que pode se ligar a outras.</p><ul><li>Clique em <b>+ Neurônio</b> para criar um novo.</li><li>Digite <code>[[</code> no texto para ligar um neurônio a outro. As ligações viram fios no mapa.</li><li>Adicione tags embaixo do título e use os filtros no topo do mapa.</li></ul><p>Comece por aqui: ${link(ids.calma, 'Acalmar a mente')}</p>`,
      0,
      0
    ),
    n(
      ids.calma,
      'Acalmar a mente',
      ['mente'],
      `<h3>Tire os pensamentos da cabeça</h3><p>Quando a mente estiver cheia, escreva. Crie um neurônio de texto para cada pensamento que estiver girando aí dentro: uma preocupação, uma ideia, algo para lembrar.</p><ul class="checklist"><li data-checked="false">Criar um neurônio com o que está me preocupando</li><li data-checked="false">Criar um neurônio com uma ideia que não sai da cabeça</li><li data-checked="false">Ligar os dois com <code>[[</code></li></ul><blockquote>Colocar no papel já deixa a mente mais leve.</blockquote><p>Volte para ${link(ids.boas, 'Bem-vindo aos Neurônios')}.</p>`,
      170,
      -40
    )
  ];
};

// Cada perfil tem os próprios neurônios ("neuronios-v1__<perfil>")
const load = () => {
  try {
    const raw = readProfileRaw(STORAGE_KEY, getActiveProfileId());
    if (!raw) return { notes: starter(), view: {} };
    const v = JSON.parse(raw);
    return {
      notes: Array.isArray(v.notes) ? v.notes.filter((n) => n && n.id) : [],
      view: v.view && typeof v.view === 'object' ? v.view : {}
    };
  } catch (e) {
    return { notes: starter(), view: {} };
  }
};

// =========================================================
// HOOK
// =========================================================
export function useNeuronios() {
  const [data, setData] = useState(load);
  const [saveError, setSaveError] = useState(false);
  const first = useRef(true);
  const keyRef = useRef(profileKey(STORAGE_KEY, getActiveProfileId()));

  // Salva (com um pequeno atraso para não gravar a cada tecla)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (localStorage.getItem(keyRef.current)) return;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(keyRef.current, JSON.stringify(data));
        setSaveError(false);
      } catch (e) {
        setSaveError(true);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [data]);

  const notes = data.notes;
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  });

  const addNote = useCallback((fields = {}) => {
    const now = new Date().toISOString();
    const note = {
      id: uid(),
      title: (fields.title || '').trim() || 'Novo neurônio',
      tags: fields.tags || [],
      content: fields.content || '',
      // Cada neurônio novo nasce com uma cor aleatória da paleta
      color: fields.color || TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
      createdAt: now,
      updatedAt: now,
      x: fields.x,
      y: fields.y
    };
    setData((d) => ({ ...d, notes: [...d.notes, note] }));
    return note;
  }, []);

  const updateNote = useCallback((id, fields) => {
    setData((d) => ({
      ...d,
      notes: d.notes.map((n) => (n.id === id ? { ...n, ...fields, updatedAt: new Date().toISOString() } : n))
    }));
  }, []);

  // Posições do mapa (sem mexer na data de edição)
  const savePositions = useCallback((positions) => {
    setData((d) => ({
      ...d,
      notes: d.notes.map((n) => (positions[n.id] ? { ...n, x: positions[n.id].x, y: positions[n.id].y } : n))
    }));
  }, []);

  const deleteNote = useCallback((id) => {
    let removed = null;
    setData((d) => {
      removed = d.notes.find((n) => n.id === id) || null;
      return { ...d, notes: d.notes.filter((n) => n.id !== id) };
    });
    return removed;
  }, []);

  // ---------- Páginas (+Pag) ----------
  const addPage = useCallback((noteId, fields = {}) => {
    const now = new Date().toISOString();
    const page = {
      id: `pg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: (fields.title || '').trim() || 'Nova página',
      content: fields.content || '',
      createdAt: now,
      updatedAt: now
    };
    setData((d) => ({
      ...d,
      notes: d.notes.map((n) => (n.id === noteId ? { ...n, pages: { ...(n.pages || {}), [page.id]: page }, updatedAt: now } : n))
    }));
    return page;
  }, []);

  const updatePage = useCallback((noteId, pageId, fields) => {
    const now = new Date().toISOString();
    setData((d) => ({
      ...d,
      notes: d.notes.map((n) => {
        if (n.id !== noteId || !n.pages || !n.pages[pageId]) return n;
        return { ...n, updatedAt: now, pages: { ...n.pages, [pageId]: { ...n.pages[pageId], ...fields, updatedAt: now } } };
      })
    }));
  }, []);

  /** Exclui uma página (e as páginas que estão dentro dela) e tira as marcas +Pag do texto. */
  const deletePage = useCallback((noteId, pageId) => {
    const owner = notesRef.current.find((n) => n.id === noteId);
    if (!owner || !owner.pages || !owner.pages[pageId]) return;
    const gone = new Set([pageId]);
    const walk = (html) =>
      pagesIn(html).forEach((pid) => {
        if (gone.has(pid) || !owner.pages[pid]) return;
        gone.add(pid);
        walk(owner.pages[pid].content);
      });
    walk(owner.pages[pageId].content);
    const strip = (html) =>
      [...gone].reduce((h, pid) => h.replace(new RegExp(`<a\\b[^>]*data-page="${pid}"[^>]*>[\\s\\S]*?</a>(&nbsp;)?`, 'g'), ''), html || '');
    const now = new Date().toISOString();
    setData((d) => ({
      ...d,
      notes: d.notes.map((n) => {
        if (n.id !== noteId) return n;
        const pages = {};
        Object.values(n.pages || {}).forEach((p) => {
          if (!gone.has(p.id)) pages[p.id] = { ...p, content: strip(p.content) };
        });
        return { ...n, content: strip(n.content), pages, updatedAt: now };
      })
    }));
  }, []);

  /**
   * Ligar uma página com [[ ]]: ela vira um neurônio de verdade (aparece no
   * mapa). Leva junto as páginas que estão dentro dela, e as marcas +Pag que
   * apontavam para ela viram ligações [[ ]].
   */
  const promotePage = useCallback((noteId, pageId) => {
    const owner = notesRef.current.find((n) => n.id === noteId);
    const page = owner && owner.pages && owner.pages[pageId];
    if (!page) return null;
    // páginas dentro da página (em qualquer profundidade) vão junto
    const moved = new Set();
    const walk = (html) =>
      pagesIn(html).forEach((pid) => {
        if (pid === pageId || moved.has(pid) || !owner.pages[pid]) return;
        moved.add(pid);
        walk(owner.pages[pid].content);
      });
    walk(page.content);
    const now = new Date().toISOString();
    const neuron = {
      id: uid(),
      title: page.title || 'Nova página',
      tags: [],
      content: page.content || '',
      pages: Object.fromEntries([...moved].map((pid) => [pid, owner.pages[pid]])),
      color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
      createdAt: page.createdAt || now,
      updatedAt: now,
      x: typeof owner.x === 'number' ? owner.x + 90 : undefined,
      y: typeof owner.y === 'number' ? owner.y + 40 : undefined
    };
    const re = new RegExp(`<a\\b[^>]*data-page="${pageId}"[^>]*>[\\s\\S]*?</a>`, 'g');
    const swap = (html) => (html || '').replace(re, wikilinkHtml(neuron));
    setData((d) => ({
      ...d,
      notes: [
        ...d.notes.map((n) => {
          if (n.id !== noteId) return n;
          const pages = {};
          Object.values(n.pages || {}).forEach((p) => {
            if (p.id === pageId || moved.has(p.id)) return;
            pages[p.id] = { ...p, content: swap(p.content) };
          });
          return { ...n, content: swap(n.content), pages, promoted: { ...(n.promoted || {}), [pageId]: neuron.id }, updatedAt: now };
        }),
        neuron
      ]
    }));
    return neuron;
  }, []);

  // Exclui vários de uma vez (seleção no mapa); devolve os excluídos
  const deleteNotes = useCallback((ids) => {
    const set = new Set(ids);
    let removed = [];
    setData((d) => {
      removed = d.notes.filter((n) => set.has(n.id));
      return { ...d, notes: d.notes.filter((n) => !set.has(n.id)) };
    });
    return removed;
  }, []);

  const restoreNotes = useCallback((list) => {
    if (!list || !list.length) return;
    setData((d) => {
      const have = new Set(d.notes.map((n) => n.id));
      return { ...d, notes: [...d.notes, ...list.filter((n) => !have.has(n.id))] };
    });
  }, []);

  const restoreNote = useCallback((note) => {
    if (!note) return;
    setData((d) => (d.notes.some((n) => n.id === note.id) ? d : { ...d, notes: [...d.notes, note] }));
  }, []);

  const setView = useCallback((fields) => setData((d) => ({ ...d, view: { ...d.view, ...fields } })), []);

  // Tags com contagem
  const tags = useMemo(() => {
    const count = new Map();
    notes.forEach((n) => (n.tags || []).forEach((t) => count.set(t, (count.get(t) || 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, n]) => ({ tag, count: n }));
  }, [notes]);

  // Ligações (sem repetir A-B / B-A) e quem cita cada neurônio
  const { links, backlinks } = useMemo(() => {
    const seen = new Set();
    const list = [];
    const back = new Map();
    notes.forEach((n) => {
      linksIn(fullContent(n)).forEach((target) => {
        if (!byId.has(target) || target === n.id) return;
        if (!back.has(target)) back.set(target, new Set());
        back.get(target).add(n.id);
        const key = [n.id, target].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        list.push({ source: n.id, target });
      });
    });
    return { links: list, backlinks: back };
  }, [notes, byId]);

  return {
    notes,
    byId,
    tags,
    links,
    backlinks,
    view: data.view,
    saveError,
    addNote,
    updateNote,
    savePositions,
    deleteNote,
    deleteNotes,
    addPage,
    updatePage,
    promotePage,
    deletePage,
    restoreNote,
    restoreNotes,
    setView
  };
}
