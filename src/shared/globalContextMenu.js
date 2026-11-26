// =========================================================
// BOTÃO DIREITO EM TODO O PROGRAMA
// Onde o programa já tem um menu próprio (cartas, neurônios, notas…),
// ele continua mandando. Em todo o resto, aparece este menu:
//  · em campos de texto: recortar, copiar, colar, selecionar tudo
//  · com texto selecionado: copiar
//  · no resto: as opções do modo aberto (Neurônios, Santuário ou Habilidades)
// O App registra as ações em registerAppActions (abrir janelas etc.).
// =========================================================
import { addToDictionary, checkWord, warmUpSpell, wordAtPoint } from './spell/spell.js';
import { openDictionary } from './spell/DictionaryWindow.jsx';
import { tx } from '../i18n/index.jsx';
import { getMode } from '../modes/modeState.js';
import { getModeActions } from './modeBridge.js';
import { SEASONS, getSanctuaryPrefs, setSanctuary } from '../modes/arvore/components/Sanctuary.jsx';

const actions = {};
export const registerAppActions = (obj) => Object.assign(actions, obj);
const run = (k) => actions[k] && actions[k]();

const EDITABLE = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), textarea, [contenteditable=""], [contenteditable="true"]';

let menu = null;
let lastField = null;

function close() {
  if (!menu) return;
  menu.remove();
  menu = null;
}

// ---------- opções de cada modo ----------
const click = (sel) => {
  const el = document.querySelector(sel);
  if (el) el.click();
};
function modeItems(mode) {
  if (mode === 'neuronios') {
    const nr = getModeActions('neuronios');
    const tags = nr && nr.setView ? document.querySelectorAll('.nr-filter-chip.on').length : 0;
    return [
      { label: tx('Novo neurônio'), keys: 'Shift+N', run: () => nr && nr.createNeuron && nr.createNeuron() },
      {
        label: tx('Buscar neurônio'),
        keys: '/',
        run: () => {
          const input = document.querySelector('input.nr-search');
          if (input) input.focus();
        }
      },
      { label: tx('Forças do mapa (Mapa/Neuro)'), run: () => click('.nr-mapneuro') },
      ...(tags ? [{ label: tx('Limpar filtro de tags'), run: () => nr.setView({ tags: [] }) }] : [])
    ];
  }
  if (mode === 'arvore') {
    const p = getSanctuaryPrefs();
    const seasons = SEASONS.map((x) => x.id);
    const nextSeason = SEASONS[(seasons.indexOf(p.season || 'auto') + 1) % SEASONS.length];
    const view = getModeActions('arvoreView');
    const panelOpen = Boolean(document.querySelector('.sanc-panel.open'));
    return [
      { label: tx('Centralizar a câmera'), keys: 'Espaço 2×', run: () => view && view.resetView && view.resetView() },
      { label: panelOpen ? tx('Fechar layouts') : tx('Layouts e decoração'), keys: 'L', run: () => window.dispatchEvent(new Event('orbe-sanctuary-layout')) },
      { label: p.editing ? tx('Parar de mover decorações') : tx('Mover e editar decorações'), on: Boolean(p.editing), run: () => setSanctuary({ editing: !p.editing, selected: null }) },
      { label: tx('Lanternas nos galhos'), on: Boolean(p.lanterns), run: () => setSanctuary({ lanterns: !p.lanterns }) },
      { label: `${tx('Próxima estação')}: ${tx(nextSeason.label)}`, run: () => setSanctuary({ season: nextSeason.id }) },
      { label: tx('Sortear a árvore'), run: () => getModeActions('arvore')?.shuffle?.() }
    ];
  }
  return [
    { label: tx('Nova habilidade'), run: () => run('addSkill') },
    { label: tx('Organizar habilidades'), keys: 'L', run: () => run('organize') },
    { label: tx('Buscar habilidade'), run: () => run('search') },
    { label: tx('Pastas'), keys: 'G', run: () => run('folders') },
    { label: tx('Missões de hoje'), keys: 'M', run: () => run('missions') },
    { label: tx('Perfis'), keys: 'P', run: () => run('profile') }
  ];
}

// ---------- Corretor ortográfico (dicionário de verdade, em todo lugar) ----------
// Mostra no topo a correção e até mais 4 sugestões da palavra clicada.
function spellItems(hit, result) {
  if (!hit) return [];
  if (result === 'loading') return [{ label: tx('Verificando a palavra…'), disabled: true }, { sep: true }];
  if (result === 'error') return [{ label: tx('Corretor indisponível (sem internet na 1ª vez?)'), disabled: true }, { sep: true }];
  // palavra certa: abre o Dicionário ORBE (significado, sinônimos, verbos, adjetivos)
  if (!result || result.ok) return [{ label: tx('📖 +Dicionário ORBE'), run: () => openDictionary(hit.word) }, { sep: true }];
  const list = result.suggestions || [];
  const add = { label: tx('Adicionar “{w}” ao dicionário', { w: hit.word }), run: () => addToDictionary(hit.word) };
  if (!list.length) return [{ label: tx('Sem sugestões para “{w}”', { w: hit.word }), disabled: true }, add, { sep: true }];
  return [...list.map((w, i) => ({ label: w, strong: i === 0, run: () => hit.apply(w) })), add, { sep: true }];
}

function itemsFor(target, spell) {
  const field = target.closest && target.closest(EDITABLE);
  if (field && !field.disabled) {
    lastField = field;
    const fixes = spell ? spellItems(spell.hit, spell.result) : [];
    const ro = field.readOnly;
    const hasSel = (() => {
      try {
        if (field.isContentEditable) return Boolean(String(window.getSelection() || ''));
        return field.selectionStart !== field.selectionEnd;
      } catch {
        return false;
      }
    })();
    return [
      ...fixes,
      { label: tx('Recortar'), keys: 'Ctrl+X', disabled: ro || !hasSel, run: () => document.execCommand('cut') },
      { label: tx('Copiar'), keys: 'Ctrl+C', disabled: !hasSel, run: () => document.execCommand('copy') },
      {
        label: tx('Colar'),
        keys: 'Ctrl+V',
        disabled: ro,
        run: async () => {
          if (lastField) lastField.focus();
          try {
            const text = await navigator.clipboard.readText();
            if (text) document.execCommand('insertText', false, text);
          } catch {
            document.execCommand('paste');
          }
        }
      },
      { sep: true },
      {
        label: tx('Selecionar tudo'),
        keys: 'Ctrl+A',
        run: () => {
          if (lastField) lastField.focus();
          if (lastField && lastField.select && !lastField.isContentEditable) lastField.select();
          else document.execCommand('selectAll');
        }
      }
    ];
  }

  const sel = String(window.getSelection ? window.getSelection() : '').trim();
  const out = [];
  if (sel) out.push({ label: tx('Copiar'), keys: 'Ctrl+C', run: () => document.execCommand('copy') }, { sep: true });
  out.push(...modeItems(getMode()));
  return out;
}

function open(x, y, items) {
  close();
  menu = document.createElement('div');
  menu.className = 'orbe-ctx';
  menu.setAttribute('role', 'menu');
  items.forEach((it) => {
    if (it.sep) {
      const hr = document.createElement('div');
      hr.className = 'orbe-ctx-sep';
      menu.appendChild(hr);
      return;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `orbe-ctx-item${it.on ? ' on' : ''}${it.strong ? ' strong' : ''}`;
    b.setAttribute('role', 'menuitem');
    b.disabled = Boolean(it.disabled);
    const lb = document.createElement('span');
    lb.className = 'orbe-ctx-label';
    lb.textContent = it.label;
    b.append(lb);
    if (it.on || it.keys) {
      const k = document.createElement('kbd');
      k.textContent = it.on ? '✓' : it.keys;
      b.appendChild(k);
    }
    // mousedown: o campo de texto não perde a seleção antes de copiar
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      close();
      it.run && it.run();
    });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  const w = menu.offsetWidth;
  const h = menu.offsetHeight;
  menu.style.left = `${Math.max(6, Math.min(x, window.innerWidth - w - 6))}px`;
  menu.style.top = `${Math.max(6, Math.min(y, window.innerHeight - h - 6))}px`;
  const first = menu.querySelector('button:not(:disabled)');
  if (first) first.focus({ preventScroll: true });
}

let installed = false;
let spellToken = null;
export function installGlobalContextMenu() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  // bolha (depois dos menus próprios): só age se ninguém tratou o clique
  document.addEventListener('contextmenu', (e) => {
    if (e.defaultPrevented) return;
    if (e.target.closest && e.target.closest('.orbe-ctx')) {
      e.preventDefault();
      return;
    }
    // Shift + botão direito: menu do navegador (para quem precisar)
    if (e.shiftKey) return;
    e.preventDefault();
    const field = e.target.closest && e.target.closest(EDITABLE);
    const hit = field && !field.disabled && field.spellcheck !== false && field.type !== 'password' ? wordAtPoint(field, e.clientX, e.clientY) : null;
    if (!hit) {
      open(e.clientX, e.clientY, itemsFor(e.target, null));
      return;
    }
    // abre já (com "verificando…") e completa quando o corretor responder
    const x = e.clientX;
    const y = e.clientY;
    const target = e.target;
    const token = {};
    spellToken = token;
    open(x, y, itemsFor(target, { hit, result: 'loading' }));
    checkWord(hit.word, hit.context).then(
      (result) => {
        if (spellToken === token && menu) open(x, y, itemsFor(target, { hit, result }));
      },
      () => {
        if (spellToken === token && menu) open(x, y, itemsFor(target, { hit, result: 'error' }));
      }
    );
  });
  // prepara o corretor (baixa os dicionários na 1ª vez) assim que alguém for escrever
  const warm = (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest(EDITABLE)) {
      document.removeEventListener('focusin', warm, true);
      setTimeout(warmUpSpell, 800);
    }
  };
  document.addEventListener('focusin', warm, true);
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (menu && !menu.contains(e.target)) close();
    },
    true
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if (!menu) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = [...menu.querySelectorAll('button:not(:disabled)')];
        const i = list.indexOf(document.activeElement);
        const next = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
        next && next.focus();
      }
    },
    true
  );
  window.addEventListener('blur', close);
  window.addEventListener('resize', close);
  document.addEventListener('scroll', close, true);
}
