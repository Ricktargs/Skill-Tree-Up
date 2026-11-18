// =========================================================
// NEURÔNIOS — dados (notas, tags e ligações [[ ]])
// Cada neurônio é uma nota em HTML. As ligações entre neurônios
// ficam no próprio texto como <a class="wikilink" data-id="...">.
// =========================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeHtml } from '../arvore/lib/html.js';

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

// Mantém as ligações e checklists, remove o perigoso
export const cleanHtml = (html) => sanitizeHtml(html);

// ---------- Neurônios de exemplo (primeira vez) ----------
const starter = () => {
  const now = new Date().toISOString();
  const ids = { boas: uid(), ligar: uid(), tags: uid(), editor: uid(), ideias: uid() };
  const link = (id, title) => `<a class="wikilink" data-id="${id}" contenteditable="false">${title}</a>`;
  const n = (id, title, tags, content, x, y) => ({ id, title, tags, content, createdAt: now, updatedAt: now, x, y });
  return [
    n(
      ids.boas,
      'Bem-vindo aos Neurônios',
      ['inicio'],
      `<h2>Seu mapa de ideias</h2><p>Cada bolinha do mapa é um <b>neurônio</b>: uma nota que pode se ligar a outras.</p><ul><li>Veja como ${link(ids.ligar, 'Ligar neurônios')}</li><li>Organize com ${link(ids.tags, 'Tags e filtros')}</li><li>Conheça o ${link(ids.editor, 'Editor de texto')}</li></ul>`,
      0,
      0
    ),
    n(
      ids.ligar,
      'Ligar neurônios',
      ['inicio', 'dica'],
      `<p>Digite <code>[[</code> no texto e escolha um neurônio para criar uma ligação. Se ele ainda não existir, é criado na hora.</p><p>As ligações viram fios no mapa. Clique numa ligação para abrir o neurônio. Volte para ${link(ids.boas, 'Bem-vindo aos Neurônios')}.</p>`,
      140,
      -60
    ),
    n(
      ids.tags,
      'Tags e filtros',
      ['inicio', 'dica'],
      `<p>Adicione tags embaixo do título. No topo do mapa, clique nas tags para <b>filtrar</b> só os neurônios delas.</p><blockquote>Ative “Tags no mapa” para ver as tags como nós, igual ao Obsidian.</blockquote>`,
      -150,
      -40
    ),
    n(
      ids.editor,
      'Editor de texto',
      ['dica'],
      `<h3>Atalhos de escrita</h3><ul><li><code>#</code> + espaço → título</li><li><code>-</code> + espaço → lista</li><li><code>[]</code> + espaço → caixa de seleção</li><li><code>&gt;</code> + espaço → citação</li></ul><ul class="checklist"><li data-checked="true">Escrever a primeira ideia</li><li data-checked="false">Ligar duas ideias</li></ul>`,
      40,
      150
    ),
    n(ids.ideias, 'Ideias soltas', ['ideia'], `<p>Um neurônio sem ligações também tem seu lugar. Ligue-o a ${link(ids.boas, 'Bem-vindo aos Neurônios')} quando quiser.</p>`, -120, 140)
  ];
};

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

  // Salva (com um pequeno atraso para não gravar a cada tecla)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (localStorage.getItem(STORAGE_KEY)) return;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setSaveError(false);
      } catch (e) {
        setSaveError(true);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [data]);

  const notes = data.notes;
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  const addNote = useCallback((fields = {}) => {
    const now = new Date().toISOString();
    const note = {
      id: uid(),
      title: (fields.title || '').trim() || 'Novo neurônio',
      tags: fields.tags || [],
      content: fields.content || '',
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
      linksIn(n.content).forEach((target) => {
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
    restoreNote,
    setView
  };
}
