import React, { useEffect, useMemo, useState } from 'react';

// =========================================================
// PRESSETS — modelos de nota do editor de notas
// Cada presset diz: para qual pasta a nota vai, como nasce o título,
// o texto inicial, as tags, o emoji, se já nasce neurônio e a data/hora.
// Marcadores aceitos no título e no texto: {data} {hora} {semana} ...
// =========================================================

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const pad = (n) => String(n).padStart(2, '0');

export const TOKENS = [
  ['{data}', 'data (19/11/2026)'],
  ['{hora}', 'hora (14:30)'],
  ['{semana}', 'dia da semana'],
  ['{dia}', 'dia'],
  ['{mes}', 'mês (número)'],
  ['{mes-nome}', 'mês por extenso'],
  ['{ano}', 'ano'],
  ['{data-iso}', 'data (2026-11-19)'],
  ['{n}', 'número da nota (1, 2, 3…)'],
  ['{pasta}', 'nome da pasta']
];

export const emptyPreset = () => ({
  name: 'Novo presset',
  emoji: '📋',
  folderId: null,
  title: '{data} — ',
  content: '',
  tags: [],
  asNeuron: false,
  dateOffset: 0, // dias a partir de hoje (1 = amanhã, -1 = ontem)
  time: '', // hora fixa "HH:MM" (vazio = hora de agora)
  openAfter: true
});

// Data/hora que o presset usa
const presetDate = (p, now = new Date()) => {
  const d = new Date(now);
  d.setDate(d.getDate() + (Number(p.dateOffset) || 0));
  if (/^\d{1,2}:\d{2}$/.test(p.time || '')) {
    const [h, m] = p.time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
};

export const fillTokens = (text, p, ctx = {}) => {
  const d = presetDate(p, ctx.now);
  const map = {
    '{data}': `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    '{hora}': `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    '{semana}': WEEKDAYS[d.getDay()],
    '{dia}': pad(d.getDate()),
    '{mes}': pad(d.getMonth() + 1),
    '{mes-nome}': MONTHS[d.getMonth()],
    '{ano}': String(d.getFullYear()),
    '{data-iso}': `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    '{n}': String(ctx.n || 1),
    '{pasta}': ctx.folderName || ''
  };
  return String(text || '').replace(/\{[a-z-]+\}/gi, (k) => (k.toLowerCase() in map ? map[k.toLowerCase()] : k));
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Texto simples do presset -> HTML do editor
//  # Título   - item   - [ ] tarefa   > citação   (linha em branco separa)
export const templateToHtml = (text) => {
  const out = [];
  let list = null; // { tag, cls, items }
  const flush = () => {
    if (!list) return;
    out.push(`<ul${list.cls ? ` class="${list.cls}"` : ''}>${list.items.join('')}</ul>`);
    list = null;
  };
  String(text || '')
    .split('\n')
    .forEach((raw) => {
      const line = raw.replace(/\s+$/, '');
      const task = line.match(/^\s*[-*]\s*\[( |x|X)?\]\s*(.*)$/);
      const item = !task && line.match(/^\s*[-*]\s+(.*)$/);
      if (task) {
        if (!list || list.cls !== 'checklist') flush();
        if (!list) list = { cls: 'checklist', items: [] };
        list.items.push(`<li data-checked="${task[1] && task[1] !== ' ' ? 'true' : 'false'}">${esc(task[2]) || '<br>'}</li>`);
        return;
      }
      if (item) {
        if (!list || list.cls) flush();
        if (!list) list = { cls: '', items: [] };
        list.items.push(`<li>${esc(item[1])}</li>`);
        return;
      }
      flush();
      if (!line.trim()) return;
      if (/^#{1,3}\s+/.test(line)) out.push(`<h3>${esc(line.replace(/^#{1,3}\s+/, ''))}</h3>`);
      else if (/^>\s?/.test(line)) out.push(`<blockquote>${esc(line.replace(/^>\s?/, ''))}</blockquote>`);
      else out.push(`<p>${esc(line)}</p>`);
    });
  flush();
  return out.join('');
};

// Cria a nota seguindo o presset
export function createFromPreset(store, preset) {
  const folderOk = preset.folderId && store.folders.some((f) => f.id === preset.folderId);
  const folderId = folderOk ? preset.folderId : null;
  const folderName = folderOk ? store.folders.find((f) => f.id === folderId).name : '';
  const n = store.notes.filter((x) => x.presetId === preset.id).length + 1;
  const ctx = { n, folderName, now: new Date() };
  const note = store.addNote({
    isNeuron: Boolean(preset.asNeuron),
    folderId,
    title: fillTokens(preset.title, preset, ctx).trim() || preset.name,
    content: templateToHtml(fillTokens(preset.content, preset, ctx)),
    tags: (preset.tags || []).map((t) => fillTokens(t, preset, ctx).trim().toLowerCase()).filter(Boolean),
    emoji: preset.emoji || null,
    presetId: preset.id,
    order: -Math.round(Date.now() / 1000) // entra no topo da pasta (a mais nova primeiro)
  });
  return note;
}

// Caminho da pasta ("Estudos / Inglês") para as listas de escolha
export const folderPaths = (folders) => {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path = (f) => {
    const parts = [];
    let cur = f;
    let guard = 0;
    while (cur && guard++ < 20) {
      parts.unshift(cur.name);
      cur = byId.get(cur.parentId);
    }
    return parts.join(' / ');
  };
  return folders.map((f) => ({ id: f.id, label: path(f) })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
};

const EMOJI_CHOICES = ['📋', '📝', '📅', '🗓️', '☀️', '🌙', '📚', '🧠', '💡', '🎯', '✅', '💼', '🏋️', '🍎', '💰', '🎵', '✈️', '❤️', '🔥', '⭐'];

// ---------- Janela para criar / editar um presset ----------
export function PresetEditor({ preset, folders, onSave, onDelete, onClose }) {
  const [p, setP] = useState(() => ({ ...emptyPreset(), ...preset }));
  const [tagsText, setTagsText] = useState(() => (preset.tags || []).join(', '));
  const set = (fields) => setP((cur) => ({ ...cur, ...fields }));
  const paths = useMemo(() => folderPaths(folders), [folders]);
  const folderName = (paths.find((x) => x.id === p.folderId) || {}).label || '';

  useEffect(() => {
    const key = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);

  const save = () => {
    onSave({
      ...p,
      name: p.name.trim() || 'Presset',
      tags: tagsText
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean)
    });
  };

  const ctx = { n: 1, folderName: folderName.split(' / ').pop() };
  const previewTitle = fillTokens(p.title, p, ctx).trim() || p.name;

  return (
    <div className="np-preset-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="np-preset-window" role="dialog" aria-label="Editar presset">
        <div className="np-preset-head">
          <h3>{preset.id ? 'Editar presset' : 'Novo presset'}</h3>
          <button type="button" className="nr-window-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="np-preset-body">
          <div className="np-pf-row">
            <label className="np-pf" style={{ flex: 1 }}>
              <span>Nome do presset</span>
              <input className="search-input" autoFocus value={p.name} onChange={(e) => set({ name: e.target.value })} onFocus={(e) => e.target.select()} />
            </label>
            <label className="np-pf">
              <span>Pasta de destino</span>
              <select className="search-input" value={p.folderId || ''} onChange={(e) => set({ folderId: e.target.value || null })}>
                <option value="">Sem pasta</option>
                {paths.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="np-pf">
            <span>Emoji</span>
            <div className="np-pf-emojis">
              {EMOJI_CHOICES.map((em) => (
                <button key={em} type="button" className={p.emoji === em ? 'on' : ''} onClick={() => set({ emoji: em })}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          <label className="np-pf">
            <span>Título da nota</span>
            <input className="search-input" value={p.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Diário {data}" />
            <small className="np-pf-preview">
              Vai ficar: <b>{previewTitle}</b>
            </small>
          </label>

          <div className="np-pf-row">
            <label className="np-pf">
              <span>Data usada</span>
              <select className="search-input" value={String(p.dateOffset || 0)} onChange={(e) => set({ dateOffset: Number(e.target.value) })}>
                <option value="-1">Ontem</option>
                <option value="0">Hoje (dia de criar)</option>
                <option value="1">Amanhã</option>
                <option value="7">Daqui a 1 semana</option>
                <option value="30">Daqui a 30 dias</option>
              </select>
            </label>
            <label className="np-pf">
              <span>Hora</span>
              <span className="np-pf-time">
                <input className="search-input" type="time" value={p.time || ''} onChange={(e) => set({ time: e.target.value })} />
                {p.time && (
                  <button type="button" className="btn small" onClick={() => set({ time: '' })} title="Usar a hora em que a nota for criada">
                    Agora
                  </button>
                )}
              </span>
              <small className="np-pf-preview">{p.time ? 'Hora fixa' : 'Vazio = hora em que criar'}</small>
            </label>
          </div>

          <label className="np-pf">
            <span>Texto inicial</span>
            <textarea
              className="search-input np-pf-text"
              value={p.content}
              onChange={(e) => set({ content: e.target.value })}
              placeholder={'# Como foi o dia\n- [ ] Tarefa\n- Item\n> Citação\nTexto normal — {semana}, {hora}'}
              rows={7}
            />
          </label>
          <div className="np-pf-tokens">
            {TOKENS.map(([tk, label]) => (
              <button key={tk} type="button" title={label} onClick={() => set({ content: `${p.content}${tk}` })}>
                {tk}
              </button>
            ))}
            <small>
              Clique para colocar no texto · <code># </code>título · <code>- [ ] </code>tarefa · <code>- </code>item · <code>&gt; </code>citação
            </small>
          </div>

          <label className="np-pf">
            <span>Tags (separadas por vírgula)</span>
            <input className="search-input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="diario, {mes-nome}" />
          </label>

          <div className="np-pf-checks">
            <label>
              <input type="checkbox" checked={Boolean(p.asNeuron)} onChange={(e) => set({ asNeuron: e.target.checked })} /> Já nasce como neurônio (aparece no mapa)
            </label>
            <label>
              <input type="checkbox" checked={p.openAfter !== false} onChange={(e) => set({ openAfter: e.target.checked })} /> Abrir a nota depois de criar
            </label>
          </div>
        </div>

        <div className="np-preset-foot">
          {preset.id && (
            <button type="button" className="btn small danger" onClick={() => onDelete(preset)}>
              🗑 Excluir presset
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn small" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn small btn-primary" onClick={save}>
            Salvar presset
          </button>
        </div>
      </div>
    </div>
  );
}
