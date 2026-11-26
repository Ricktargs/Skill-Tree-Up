// =========================================================
// DICIONÁRIO ORBE — busca a palavra no Wikcionário (pt.wiktionary.org)
// e organiza: significados (com frases de exemplo), sinônimos/antônimos,
// conjugação (verbos), flexões (adjetivos) e palavras derivadas.
// Formas flexionadas ("corri", "casas") levam à palavra base ("correr").
// =========================================================
import { baseForms, enrichEntry } from './dictionaryExtra.js';

const API = 'https://pt.wiktionary.org/w/api.php';
const cache = new Map();

const CLASS_NAMES = [
  'Substantivo', 'Verbo', 'Adjetivo', 'Advérbio', 'Pronome', 'Preposição', 'Conjunção', 'Interjeição',
  'Numeral', 'Artigo', 'Locução', 'Expressão', 'Contração', 'Sigla', 'Abreviatura', 'Forma verbal', 'Flexão', 'Forma flexionada'
];
const isClass = (t) => CLASS_NAMES.some((c) => t.startsWith(c));
const clean = (t) => String(t || '').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();

async function fetchPage(title) {
  const url = `${API}?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2&redirects=1&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) return null;
  return j.parse ? { title: j.parse.title, html: j.parse.text } : null;
}

// Pedaço da página de um idioma (entre um <h1> de idioma e o próximo)
function languageBlock(doc, preferred = 'Português') {
  const heads = [...doc.querySelectorAll('.mw-heading1, h1')].filter((h) => h.tagName === 'H1' || h.classList.contains('mw-heading1'));
  const tops = heads.map((h) => (h.classList.contains('mw-heading1') ? h : h.closest('.mw-heading1') || h));
  const uniq = [...new Set(tops)];
  const nameOf = (h) => clean(h.textContent).replace(/editar/gi, '').replace(/[[\]]/g, '').trim();
  let start = uniq.find((h) => nameOf(h).startsWith(preferred));
  let lang = preferred;
  if (!start && uniq.length) {
    start = uniq[0];
    lang = nameOf(start);
  }
  if (!start) return null;
  const nodes = [];
  for (let n = start.nextElementSibling; n; n = n.nextElementSibling) {
    if (uniq.includes(n)) break;
    nodes.push(n);
  }
  return { lang, nodes };
}

const headingOf = (el) => {
  if (!el || !el.classList) return null;
  const m = el.className.match(/mw-heading(\d)/);
  if (m) return { level: Number(m[1]), text: clean(el.querySelector('h1,h2,h3,h4,h5')?.textContent || el.textContent) };
  if (/^H[2-5]$/.test(el.tagName)) return { level: Number(el.tagName[1]), text: clean(el.textContent) };
  return null;
};

// <li> de definição: o texto sem os exemplos + os exemplos
function readDefinition(li) {
  const copy = li.cloneNode(true);
  const examples = [];
  copy.querySelectorAll(':scope > ul > li, :scope > dl dd').forEach((ex) => {
    const t = clean(ex.textContent);
    // citações longas com fonte (ano, autor) ficam fora: só a frase em itálico
    const it = ex.querySelector('i');
    const sentence = clean(it ? it.textContent : t);
    if (sentence && sentence.length > 3 && !/^\d{4}\b/.test(sentence)) examples.push(sentence);
  });
  copy.querySelectorAll('ul, dl, sup, .mw-editsection').forEach((x) => x.remove());
  return { text: clean(copy.textContent), examples: [...new Set(examples)].slice(0, 3) };
}

function readConjugation(container) {
  const out = { impessoal: {}, tempos: [] };
  let mode = '';
  container.querySelectorAll('tr').forEach((tr) => {
    const ths = [...tr.querySelectorAll('th')].map((th) => clean(th.textContent));
    const tds = [...tr.querySelectorAll('td')].map((td) => clean(td.textContent));
    const modeTh = ths.find((t) => /^Modo/i.test(t));
    if (modeTh) mode = modeTh.replace(/^Modo\s*/i, '');
    // formas impessoais: pares (th, td)
    if (tds.length && tds.length * 2 === [...tr.children].length && !tr.querySelector('th[rowspan]')) {
      [...tr.children].forEach((c, i, arr) => {
        if (c.tagName === 'TH' && arr[i + 1] && arr[i + 1].tagName === 'TD') out.impessoal[clean(c.textContent)] = clean(arr[i + 1].textContent);
      });
      return;
    }
    if (tds.length === 6) {
      const tense = ths[ths.length - 1];
      if (tense && !/^Modo/i.test(tense)) out.tempos.push({ modo: mode, tempo: tense, formas: tds });
    }
  });
  return out;
}

function readFlexions(table) {
  // quadro "Singular/Plural" × "Masculino/Feminino"
  const rows = [...table.querySelectorAll('tr')];
  const head = rows[0] ? [...rows[0].children].map((c) => clean(c.textContent)) : [];
  const out = [];
  rows.slice(1).forEach((tr) => {
    const cells = [...tr.children].map((c) => clean(c.textContent));
    const g = cells[0];
    cells.slice(1).forEach((f, i) => f && out.push({ label: `${g} ${head[i + 1] || ''}`.trim(), form: f }));
  });
  return out;
}

function parse(html, preferredLang) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style, .mw-editsection, link').forEach((x) => x.remove());
  const block = languageBlock(doc, preferredLang);
  if (!block) return null;
  const entry = { lang: block.lang, classes: [], synonyms: [], antonyms: [], derived: [], conjugation: null, flexions: [], formOf: null };
  let curClass = null;
  let curSub = '';
  for (const el of block.nodes) {
    const h = headingOf(el);
    if (h) {
      if (h.level === 2) {
        curSub = '';
        const name = h.text.replace(/\d+$/, '').trim();
        if (isClass(name)) {
          curClass = { name, info: '', defs: [] };
          entry.classes.push(curClass);
        } else curClass = null;
      } else curSub = h.text.replace(/\d+$/, '').trim();
      continue;
    }
    if (curSub === 'Sinônimos' || curSub === 'Sinónimos') {
      el.querySelectorAll('li a, a').forEach((a) => entry.synonyms.push(clean(a.textContent)));
      continue;
    }
    if (curSub === 'Antônimos' || curSub === 'Antónimos') {
      el.querySelectorAll('li a, a').forEach((a) => entry.antonyms.push(clean(a.textContent)));
      continue;
    }
    if (/^(Verbetes derivados|Termos derivados|Ver também|Palavras relacionadas)/.test(curSub)) {
      el.querySelectorAll('li a').forEach((a) => entry.derived.push(clean(a.textContent)));
      continue;
    }
    if (/^Conjuga/.test(curSub)) {
      if (!entry.conjugation && el.querySelector && el.querySelector('table')) entry.conjugation = readConjugation(el);
      continue;
    }
    if (!curClass || curSub) continue;
    if (el.tagName === 'TABLE' && el.classList.contains('flexpt')) {
      if (!entry.flexions.length) entry.flexions = readFlexions(el);
      continue;
    }
    if (el.tagName === 'P' && !curClass.info) curClass.info = clean(el.textContent);
    if (el.tagName === 'OL') {
      [...el.children].forEach((li) => {
        if (li.tagName !== 'LI' || li.classList.contains('mw-empty-elt')) return;
        const d = readDefinition(li);
        if (d.text) curClass.defs.push(d);
        // forma flexionada: "primeira pessoa ... do verbo correr" → palavra base
        if (!entry.formOf && (/^(Forma|Flexão)/.test(curClass.name) || /^(o |a )?(plural|feminino|masculino|singular|diminutivo|aumentativo|superlativo)\b.*\bde\b/i.test(d.text))) {
          const links = [...li.querySelectorAll('a')].filter((a) => !/^(singular|plural|feminino|masculino)$/i.test(clean(a.textContent)));
          const last = links[links.length - 1];
          if (last) entry.formOf = clean(last.textContent);
        }
      });
    }
  }
  const uniq = (a) => [...new Set(a.filter((x) => x && x.length < 40 && !x.includes(':')))];
  entry.synonyms = uniq(entry.synonyms);
  entry.antonyms = uniq(entry.antonyms);
  entry.derived = uniq(entry.derived);
  entry.classes = entry.classes.filter((c) => c.defs.length);
  return entry;
}

// Wikcionário: { word, entry, base?, formInfo? } ou null
async function wiktionary(word, key) {
  // começo de frase ("Feliz") procura primeiro a palavra comum ("feliz")
  let page = word !== key && word !== word.toUpperCase() ? await fetchPage(key) : null;
  if (page && !parse(page.html, 'Português')?.classes.length) page = null;
  if (!page) page = await fetchPage(word);
  if (!page && word !== key) page = await fetchPage(key);
  if (!page) return null;
  const entry = parse(page.html, 'Português');
  if (!entry) return null;
  // forma flexionada sem verbete próprio → mostra a palavra base
  // (seção "Forma/Flexão" ou definições do tipo "plural de bonito", "feminino de...")
  const FORM_DEF = /^(o |a )?(plural|feminino|masculino|singular|diminutivo|aumentativo|superlativo|primeira|segunda|terceira|forma)\b.*\bde\b/i;
  const onlyForms = entry.classes.every((c) => /^(Forma|Flexão)/.test(c.name) || (c.defs.length && c.defs.every((d) => FORM_DEF.test(d.text))));
  if (entry.formOf && onlyForms && entry.formOf.toLowerCase() !== key) {
    const basePage = await fetchPage(entry.formOf);
    const baseEntry = basePage ? parse(basePage.html, 'Português') : null;
    if (baseEntry) return { word, base: basePage.title, formInfo: entry.classes[0]?.defs[0]?.text || '', entry: baseEntry };
  }
  return { word: page.title || word, entry };
}

/** Busca a palavra. Devolve { word, entry, base? } ou { word, missing: true }. */
export async function lookupWord(rawWord) {
  const word = String(rawWord || '').trim();
  const key = word.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    let raw = await wiktionary(word, key).catch(() => null);
    // sem verbete próprio (ex.: "bonitas"): tenta singular / masculino → "bonito"
    if (!raw || !raw.entry.classes.length) {
      for (const b of baseForms(word).slice(1)) {
        const r2 = await wiktionary(b, b).catch(() => null);
        if (r2 && r2.entry.classes.length) {
          raw = { word, base: r2.base || r2.word, formInfo: '', entry: r2.entry };
          break;
        }
      }
    }
    // completa o que faltar (sinônimos, família, conjugação, significado de reserva)
    const entry = await enrichEntry(raw && raw.base ? raw.base : word, raw && raw.entry ? raw.entry : null);
    const nothing = !entry.classes.length && !entry.synonyms.length && !entry.relatedVerbs.length && !entry.relatedAdjs.length;
    if (nothing) return { word, missing: true };
    return { ...(raw || { word }), entry };
  })();
  cache.set(key, p);
  try {
    return await p;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

// heurísticas para "relacionados" quando a palavra não é verbo / adjetivo
export const looksVerb = (w) => /^[\p{L}-]{3,}(ar|er|ir|or|ôr)$/u.test(w) && !/\s/.test(w);
export const looksAdjective = (w) =>
  /(oso|osa|ado|ada|ido|ida|ível|ável|al|ico|ica|ante|ente|ivo|iva|ário|ária|ês|esa|eiro|eira|udo|uda|inho|inha|ento|enta)$/u.test(w) && !/\s/.test(w);
