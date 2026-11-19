// =========================================================
// NEURÔNIOS — dados (notas, tags e ligações [[ ]])
// Cada neurônio é uma nota em HTML. As ligações entre neurônios
// ficam no próprio texto como <a class="wikilink" data-id="...">.
// =========================================================
import { useMemo, useSyncExternalStore } from 'react';
import { sanitizeHtml } from '../arvore/lib/html.js';
import { profileKey, readProfileRaw } from '../../atualizacao2_0/ProfileStorage.js';
import { getActiveProfileId, useActiveProfileId } from '../../shared/activeProfile.js';

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
// Cores escolhidas pela pessoa para cada tag (guardadas em view.tagColors)
let TAG_OVERRIDES = {};
// Copia idempotente das cores salvas: tagColor() é usada em vários lugares fora do hook
const syncTagOverrides = (colors) => {
  TAG_OVERRIDES = colors || {};
};
export const tagColor = (tag) => TAG_OVERRIDES[tag] || TAG_COLORS[hash(String(tag || '')) % TAG_COLORS.length];

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
const load = (pid) => {
  try {
    const raw = readProfileRaw(STORAGE_KEY, pid);
    if (!raw) return { notes: starter(), folders: [], view: {} };
    const v = JSON.parse(raw);
    return {
      notes: Array.isArray(v.notes) ? v.notes.filter((n) => n && n.id) : [],
      folders: Array.isArray(v.folders) ? v.folders.filter((f) => f && f.id) : [],
      presets: Array.isArray(v.presets) ? v.presets.filter((p) => p && p.id) : [],
      view: v.view && typeof v.view === 'object' ? v.view : {}
    };
  } catch (e) {
    return { notes: starter(), folders: [], view: {} };
  }
};

// Neurônio = aparece no mapa. Notas do editor geral só viram neurônio
// se forem ligadas com [[ ]] (ou pelo botão "Transformar em neurônio").
export const isNeuron = (n) => n && n.isNeuron !== false;

// Quem foi ligado com [[ ]] vira neurônio sozinho (menos quem pediu para ficar só como nota)
const autoPromote = (data) => {
  const waiting = data.notes.filter((n) => n.isNeuron === false && !n.keepNote);
  if (!waiting.length) return data;
  const ids = new Set(data.notes.map((n) => n.id));
  const linked = new Set();
  data.notes.forEach((n) => {
    linksIn(fullContent(n)).forEach((t) => {
      if (!ids.has(t) || t === n.id) return;
      linked.add(t);
      linked.add(n.id);
    });
  });
  if (!waiting.some((n) => linked.has(n.id))) return data;
  return { ...data, notes: data.notes.map((n) => (n.isNeuron === false && !n.keepNote && linked.has(n.id) ? { ...n, isNeuron: true } : n)) };
};

// =========================================================
// STORE COMPARTILHADO
// O mapa (modo Neurônios) e o editor de notas (✏️, em qualquer modo) usam
// os MESMOS dados ao mesmo tempo: uma mudança num aparece no outro na hora.
// =========================================================
const shared = { pid: null, state: null, rev: 0, saveTimer: null };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const ensureLoaded = (pid) => {
  if (shared.state && shared.pid === pid) return;
  // trocou de perfil: grava o que faltava do anterior e carrega o novo
  if (shared.saveTimer && shared.state) flushSave();
  shared.pid = pid;
  shared.state = { data: load(pid), saveError: false, rev: shared.rev };
};
const getSnapshot = () => {
  ensureLoaded(getActiveProfileId());
  return shared.state;
};

const flushSave = () => {
  clearTimeout(shared.saveTimer);
  shared.saveTimer = null;
  if (!shared.state) return;
  let saveError = false;
  try {
    localStorage.setItem(profileKey(STORAGE_KEY, shared.pid), JSON.stringify(shared.state.data));
  } catch (e) {
    saveError = true;
  }
  if (saveError !== shared.state.saveError) {
    shared.state = { ...shared.state, saveError };
    emit();
  }
};

// Atualiza os dados (com um pequeno atraso para gravar, como antes)
const setData = (fn) => {
  const cur = getSnapshot();
  const next = typeof fn === 'function' ? fn(cur.data) : fn;
  if (!next || next === cur.data) return;
  shared.state = { ...cur, data: autoPromote(next) };
  emit();
  clearTimeout(shared.saveTimer);
  shared.saveTimer = setTimeout(flushSave, 300);
};

// Ctrl+Z / Ctrl+Y global devolveu os neurônios: recarrega e avisa os editores abertos
if (typeof window !== 'undefined') {
  window.addEventListener('rpg-undo-restore', (e) => {
    const keys = (e.detail && e.detail.keys) || [];
    if (!shared.pid || !keys.includes(profileKey(STORAGE_KEY, shared.pid))) return;
    clearTimeout(shared.saveTimer);
    shared.saveTimer = null;
    shared.rev += 1;
    shared.state = { data: load(shared.pid), saveError: false, rev: shared.rev };
    emit();
  });
  // Antes de fechar, grava o que ainda estava esperando
  window.addEventListener('beforeunload', () => {
    if (shared.saveTimer) flushSave();
  });
}

const nowIso = () => new Date().toISOString();
const randomColor = () => TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];

// ---------- Ações (iguais para quem usar o store) ----------
const actions = {
  addNote: (fields = {}) => {
    const now = nowIso();
    const asNeuron = fields.isNeuron !== false;
    const note = {
      id: uid(),
      title: (fields.title || '').trim() || (asNeuron ? 'Novo neurônio' : 'Nova nota'),
      tags: fields.tags || [],
      content: fields.content || '',
      // Cada neurônio novo nasce com uma cor aleatória da paleta
      color: fields.color || randomColor(),
      createdAt: now,
      updatedAt: now,
      x: fields.x,
      y: fields.y,
      ...(asNeuron ? {} : { isNeuron: false }),
      ...(fields.folderId ? { folderId: fields.folderId } : {}),
      ...(fields.emoji ? { emoji: fields.emoji } : {}),
      ...(fields.presetId ? { presetId: fields.presetId } : {}),
      ...(typeof fields.order === 'number' ? { order: fields.order } : {})
    };
    setData((d) => ({ ...d, notes: [...d.notes, note] }));
    return note;
  },

  updateNote: (id, fields) =>
    setData((d) => ({
      ...d,
      notes: d.notes.map((n) => (n.id === id ? { ...n, ...fields, updatedAt: nowIso() } : n))
    })),

  // Neurônio ↔ só nota
  setNeuron: (id, on) =>
    setData((d) => ({
      ...d,
      notes: d.notes.map((n) => {
        if (n.id !== id) return n;
        const copy = { ...n, updatedAt: nowIso() };
        if (on) {
          delete copy.isNeuron;
          delete copy.keepNote;
        } else {
          copy.isNeuron = false;
          copy.keepNote = true;
        }
        return copy;
      })
    })),

  // Posições do mapa (sem mexer na data de edição)
  savePositions: (positions) =>
    setData((d) => ({
      ...d,
      notes: d.notes.map((n) => (positions[n.id] ? { ...n, x: positions[n.id].x, y: positions[n.id].y } : n))
    })),

  deleteNote: (id) => {
    const removed = getSnapshot().data.notes.find((n) => n.id === id) || null;
    setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
    return removed;
  },

  // ---------- Páginas (+Pag) ----------
  addPage: (noteId, fields = {}) => {
    const now = nowIso();
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
  },

  updatePage: (noteId, pageId, fields) => {
    const now = nowIso();
    setData((d) => ({
      ...d,
      notes: d.notes.map((n) => {
        if (n.id !== noteId || !n.pages || !n.pages[pageId]) return n;
        return { ...n, updatedAt: now, pages: { ...n.pages, [pageId]: { ...n.pages[pageId], ...fields, updatedAt: now } } };
      })
    }));
  },

  /** Exclui uma página (e as páginas que estão dentro dela) e tira as marcas +Pag do texto. */
  deletePage: (noteId, pageId) => {
    const owner = getSnapshot().data.notes.find((n) => n.id === noteId);
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
    const now = nowIso();
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
  },

  /**
   * Ligar uma página com [[ ]]: ela vira um neurônio de verdade (aparece no
   * mapa). Leva junto as páginas que estão dentro dela, e as marcas +Pag que
   * apontavam para ela viram ligações [[ ]].
   */
  promotePage: (noteId, pageId) => {
    const owner = getSnapshot().data.notes.find((n) => n.id === noteId);
    const page = owner && owner.pages && owner.pages[pageId];
    if (!page) return null;
    const moved = new Set();
    const walk = (html) =>
      pagesIn(html).forEach((pid) => {
        if (pid === pageId || moved.has(pid) || !owner.pages[pid]) return;
        moved.add(pid);
        walk(owner.pages[pid].content);
      });
    walk(page.content);
    const now = nowIso();
    const neuron = {
      id: uid(),
      title: page.title || 'Nova página',
      tags: [],
      content: page.content || '',
      pages: Object.fromEntries([...moved].map((pid) => [pid, owner.pages[pid]])),
      color: randomColor(),
      createdAt: page.createdAt || now,
      updatedAt: now,
      x: typeof owner.x === 'number' ? owner.x + 90 : undefined,
      y: typeof owner.y === 'number' ? owner.y + 40 : undefined,
      ...(owner.folderId ? { folderId: owner.folderId } : {})
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
  },

  // Exclui vários de uma vez (seleção no mapa); devolve os excluídos
  deleteNotes: (ids) => {
    const set = new Set(ids);
    const removed = getSnapshot().data.notes.filter((n) => set.has(n.id));
    setData((d) => ({ ...d, notes: d.notes.filter((n) => !set.has(n.id)) }));
    return removed;
  },

  restoreNotes: (list) => {
    if (!list || !list.length) return;
    setData((d) => {
      const have = new Set(d.notes.map((n) => n.id));
      return { ...d, notes: [...d.notes, ...list.filter((n) => !have.has(n.id))] };
    });
  },

  restoreNote: (note) => {
    if (!note) return;
    setData((d) => (d.notes.some((n) => n.id === note.id) ? d : { ...d, notes: [...d.notes, note] }));
  },

  setView: (fields) => setData((d) => ({ ...d, view: { ...d.view, ...fields } })),

  // Cor de uma tag (null volta para a cor automática)
  setTagColor: (tag, color) =>
    setData((d) => {
      const tagColors = { ...((d.view && d.view.tagColors) || {}) };
      if (color) tagColors[tag] = color;
      else delete tagColors[tag];
      return { ...d, view: { ...d.view, tagColors } };
    }),

  // ---------- Pastas do editor de notas (com hierarquia) ----------
  addFolder: (name, parentId = null) => {
    const folder = { id: `fd_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: (name || '').trim() || 'Nova pasta', parentId: parentId || null, createdAt: nowIso() };
    setData((d) => ({ ...d, folders: [...(d.folders || []), folder] }));
    return folder;
  },
  renameFolder: (id, name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    setData((d) => ({ ...d, folders: (d.folders || []).map((f) => (f.id === id ? { ...f, name: clean.slice(0, 60) } : f)) }));
  },
  // Excluir a pasta não apaga nada: o que estava dentro sobe um nível
  deleteFolder: (id) =>
    setData((d) => {
      const folder = (d.folders || []).find((f) => f.id === id);
      if (!folder) return d;
      const up = folder.parentId || null;
      return {
        ...d,
        folders: (d.folders || []).filter((f) => f.id !== id).map((f) => (f.parentId === id ? { ...f, parentId: up } : f)),
        notes: d.notes.map((n) => (n.folderId === id ? { ...n, folderId: up } : n))
      };
    }),
  // Mover pasta para dentro de outra (sem deixar entrar nela mesma)
  moveFolder: (id, parentId) =>
    setData((d) => {
      const folders = d.folders || [];
      let p = parentId;
      while (p) {
        if (p === id) return d;
        p = (folders.find((f) => f.id === p) || {}).parentId;
      }
      return { ...d, folders: folders.map((f) => (f.id === id ? { ...f, parentId: parentId || null } : f)) };
    }),
  // Cor da pasta (e outros campos)
  updateFolder: (id, fields) =>
    setData((d) => ({ ...d, folders: (d.folders || []).map((f) => (f.id === id ? { ...f, ...fields } : f)) })),
  moveNote: (id, folderId) =>
    setData((d) => ({ ...d, notes: d.notes.map((n) => (n.id === id ? { ...n, folderId: folderId || null } : n)) })),

  // Arrastar: coloca a nota/pasta "id" dentro de "parentId" e grava a ordem
  // de todos os irmãos (orderedIds já vem na ordem final, com o próprio id).
  arrange: (kind, id, parentId, orderedIds) =>
    setData((d) => {
      const pos = new Map(orderedIds.map((x, i) => [x, i * 10]));
      if (kind === 'folder') {
        const folders = d.folders || [];
        let p = parentId;
        while (p) {
          if (p === id) return d; // não entra nela mesma
          p = (folders.find((f) => f.id === p) || {}).parentId;
        }
        return {
          ...d,
          folders: folders.map((f) => {
            if (f.id === id) return { ...f, parentId: parentId || null, order: pos.get(f.id) };
            return pos.has(f.id) ? { ...f, order: pos.get(f.id) } : f;
          })
        };
      }
      return {
        ...d,
        notes: d.notes.map((n) => {
          if (n.id === id) return { ...n, folderId: parentId || null, order: pos.get(n.id) };
          return pos.has(n.id) ? { ...n, order: pos.get(n.id) } : n;
        })
      };
    }),

  // ---------- Pressets: modelos de nota com pasta, título e texto prontos ----------
  savePreset: (preset) => {
    const p = { ...preset, id: preset.id || `ps_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
    setData((d) => {
      const list = d.presets || [];
      const has = list.some((x) => x.id === p.id);
      return { ...d, presets: has ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p] };
    });
    return p;
  },
  deletePreset: (id) => setData((d) => ({ ...d, presets: (d.presets || []).filter((x) => x.id !== id) }))
};

// =========================================================
// HOOK (mesma interface de antes, agora com dados compartilhados)
// =========================================================
export function useNeuronios() {
  useActiveProfileId(); // trocar de perfil carrega os dados dele
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const { data } = state;

  const notes = data.notes;
  // tagColor() lê as cores escolhidas para as tags
  syncTagOverrides(data.view && data.view.tagColors);
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

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
    folders: data.folders || [],
    presets: data.presets || [],
    view: data.view,
    rev: state.rev,
    saveError: state.saveError,
    ...actions
  };
}
