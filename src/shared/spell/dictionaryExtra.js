// =========================================================
// DICIONÁRIO ORBE — completa o que faltar no Wikcionário, para que toda
// palavra tenha algo em cada aba:
//   · Significado: Dicionário Aberto (reserva) e "sentidos próximos"
//   · Sinônimos: thesaurus do LibreOffice (pt-BR)
//   · Verbos / Adjetivos: palavras da mesma família, confirmadas pelo
//     dicionário do corretor (só entra o que existe de verdade)
//   · Conjugação regular gerada quando o verbo não tem tabela
// =========================================================
import { thesaurusLookup, validWords } from './spell.js';

const lower = (w) => String(w || '').toLowerCase();
export const isVerbForm = (w) => /^\p{L}{3,}(ar|er|ir|or|ôr)$/u.test(w);
// adjetivo com cara de adjetivo (para separar dos sinônimos)
const ADJ_STRICT = /(oso|osa|ado|ada|ido|ida|ível|ável|ico|ica|ivo|iva|ante|ente|eiro|eira|ês|esa|udo|uda|onho|onha)$/u;
const ADJ_RE = /(oso|osa|ado|ada|ido|ida|ível|ável|al|ico|ica|ivo|iva|ante|ente|inte|eiro|eira|ês|esa|ino|ina|udo|uda|ento|enta|ário|ária|onho|onha|ista|il|ar|or|ora|z)$/u;

// ---------- formas para procurar no thesaurus ----------
export function baseForms(word) {
  const w = lower(word);
  const out = [w];
  if (/ões$/.test(w)) out.push(w.replace(/ões$/, 'ão'));
  if (/ães$/.test(w)) out.push(w.replace(/ães$/, 'ão'));
  if (/is$/.test(w)) out.push(w.replace(/is$/, 'l'));
  if (/es$/.test(w)) out.push(w.slice(0, -2));
  if (/s$/.test(w)) out.push(w.slice(0, -1));
  const sing = out[out.length - 1];
  if (/a$/.test(sing)) out.push(sing.replace(/a$/, 'o'));
  if (/ona$/.test(sing)) out.push(sing.replace(/ona$/, 'ão'));
  return [...new Set(out)];
}

// ---------- raiz para montar a família ----------
const SUFFIXES = ['mente', 'ções', 'ção', 'sões', 'são', 'dade', 'idade', 'eza', 'ismo', 'ista', 'agem', 'mento', 'ância', 'ência', 'oso', 'osa', 'ado', 'ada', 'ido', 'ida', 'ável', 'ível', 'ear', 'ecer', 'izar', 'ar', 'er', 'ir', 'os', 'as', 'es', 'o', 'a', 'e', 's'];
function stemOf(word) {
  const w = lower(word);
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  }
  return w;
}
// raízes especiais de substantivos (amizade → amig, felicidade → felic/feliz,
// recordação → recorda, memória → memor)
const SPECIAL = [
  [/izade$/, 'ig'],
  [/icidade$/, 'iz'],
  [/idade$/, ''],
  [/ção$/, ''],
  [/ória$/, 'or'],
  [/eza$/, ''],
  [/ura$/, '']
];
// raiz com a última consoante adaptada (belez-a → bel, feliz → felic)
const stems = (word) => {
  const w = lower(word);
  const s = stemOf(w);
  const out = [s];
  SPECIAL.forEach(([re, rep]) => {
    if (re.test(w)) out.push(w.replace(re, rep));
  });
  [...out].forEach((x) => {
    if (/z$/.test(x)) out.push(x.replace(/z$/, 'c'));
    if (/c$/.test(x)) out.push(x.replace(/c$/, 'z'), x.replace(/c$/, 'qu'));
    if (/g$/.test(x)) out.push(x.replace(/g$/, 'gu'));
    if (/ç$/.test(x)) out.push(x.replace(/ç$/, 'c'));
  });
  return [...new Set(out.filter((x) => x.length >= 3))];
};

const VERB_PRE = ['', 'a', 'en', 'em', 'des', 're', 'de'];
const VERB_END = ['ar', 'er', 'ir', 'ear', 'ecer', 'izar', 'ificar', 'ejar', 'ezar', 'entar'];
const ADJ_PRE = ['', 'in', 'im', 'des'];
const ADJ_END = ['oso', 'ado', 'ido', 'ável', 'ível', 'al', 'ico', 'ivo', 'ante', 'ente', 'eiro', 'ês', 'udo', 'onho', 'il', 'eto'];
// só para as raízes especiais (felicidade → feliz, amizade → amigo)
const specialStems = (word) => {
  const w = lower(word);
  const out = [];
  SPECIAL.forEach(([re, rep]) => {
    if (re.test(w)) out.push(w.replace(re, rep));
  });
  return out.filter((x) => x.length >= 3);
};

async function familyOf(words, kind) {
  const cands = new Set();
  words.forEach((w) => {
    if (kind === 'adj') specialStems(w).forEach((s) => ['', 'o', 'e'].forEach((e) => cands.add(s + e)));
    stems(w).forEach((s) => {
      const pre = kind === 'verb' ? VERB_PRE : ADJ_PRE;
      const end = kind === 'verb' ? VERB_END : ADJ_END;
      pre.forEach((p) => end.forEach((e) => cands.add(p + s + e)));
      // raiz terminando em vogal: recorda → recordar
      if (kind === 'verb' && /[aei]$/.test(s)) pre.forEach((p) => cands.add(`${p}${s}r`));
    });
  });
  words.forEach((w) => cands.delete(lower(w)));
  if (!cands.size) return [];
  const ok = await validWords([...cands]);
  return kind === 'verb' ? ok.filter(isVerbForm) : ok;
}

// ---------- conjugação regular (quando o Wikcionário não tem a tabela) ----------
export function regularConjugation(inf) {
  const v = lower(inf);
  const m = v.match(/^(.+)(ar|er|ir)$/);
  if (!m) return null;
  const [, r, t] = m;
  const E = {
    ar: {
      pres: ['o', 'as', 'a', 'amos', 'ais', 'am'],
      perf: ['ei', 'aste', 'ou', 'amos', 'astes', 'aram'],
      imp: ['ava', 'avas', 'ava', 'ávamos', 'áveis', 'avam'],
      subj: ['e', 'es', 'e', 'emos', 'eis', 'em'],
      ger: 'ando',
      part: 'ado'
    },
    er: {
      pres: ['o', 'es', 'e', 'emos', 'eis', 'em'],
      perf: ['i', 'este', 'eu', 'emos', 'estes', 'eram'],
      imp: ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam'],
      subj: ['a', 'as', 'a', 'amos', 'ais', 'am'],
      ger: 'endo',
      part: 'ido'
    },
    ir: {
      pres: ['o', 'es', 'e', 'imos', 'is', 'em'],
      perf: ['i', 'iste', 'iu', 'imos', 'istes', 'iram'],
      imp: ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam'],
      subj: ['a', 'as', 'a', 'amos', 'ais', 'am'],
      ger: 'indo',
      part: 'ido'
    }
  }[t];
  const fut = ['ei', 'ás', 'á', 'emos', 'eis', 'ão'];
  const cond = ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam'];
  return {
    generated: true,
    impessoal: { Infinitivo: v, Gerúndio: r + E.ger, Particípio: r + E.part },
    tempos: [
      { modo: 'Indicativo', tempo: 'Presente', formas: E.pres.map((x) => r + x) },
      { modo: 'Indicativo', tempo: 'Pretérito perfeito', formas: E.perf.map((x) => r + x) },
      { modo: 'Indicativo', tempo: 'Pretérito imperfeito', formas: E.imp.map((x) => r + x) },
      { modo: 'Indicativo', tempo: 'Futuro do presente', formas: fut.map((x) => v + x) },
      { modo: 'Indicativo', tempo: 'Futuro do pretérito', formas: cond.map((x) => v + x) },
      { modo: 'Subjuntivo', tempo: 'Presente', formas: E.subj.map((x) => r + x) }
    ]
  };
}

// ---------- Dicionário Aberto (reserva de significados) ----------
const GRAM = [
  [/^adj/i, 'Adjetivo'],
  [/^adv/i, 'Advérbio'],
  [/^v\./i, 'Verbo'],
  [/^(m|f|n)\.?/i, 'Substantivo'],
  [/^pron/i, 'Pronome'],
  [/^prep/i, 'Preposição'],
  [/^conj/i, 'Conjunção'],
  [/^interj/i, 'Interjeição']
];
export async function dicionarioAberto(word) {
  try {
    const res = await fetch(`https://api.dicionario-aberto.net/word/${encodeURIComponent(lower(word))}`);
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list) || !list.length) return [];
    const doc = new DOMParser().parseFromString(list[0].xml || '', 'text/xml');
    const byClass = new Map();
    let last = 'Significado';
    doc.querySelectorAll('sense').forEach((sense) => {
      const g = (sense.querySelector('gramGrp')?.textContent || '').trim();
      const name = (GRAM.find(([re]) => re.test(g)) || [])[1] || (g ? last : last);
      last = name;
      const lines = (sense.querySelector('def')?.textContent || '').split('\n').map((x) => x.trim()).filter(Boolean);
      lines.forEach((line) => {
        const examples = [...line.matchAll(/_([^_]+)_/g)].map((m) => m[1]);
        const text = line.replace(/_([^_]+)_/g, '').replace(/[:;,.\s]+$/, '').trim();
        if (!text) return;
        if (!byClass.has(name)) byClass.set(name, { name, info: 'Dicionário Aberto', defs: [] });
        byClass.get(name).defs.push({ text, examples });
      });
    });
    return [...byClass.values()];
  } catch {
    return [];
  }
}

/**
 * Completa a entrada (do Wikcionário ou vazia) para que nenhuma aba fique vazia.
 */
export async function enrichEntry(word, entry) {
  const e = entry || { lang: 'Português', classes: [], synonyms: [], antonyms: [], derived: [], conjugation: null, flexions: [], formOf: null };
  const base = lower(word);
  const tasks = [];

  // 1) significado de reserva
  if (!e.classes.length) {
    tasks.push(
      dicionarioAberto(word).then((cls) => {
        if (cls.length) e.classes = cls;
      })
    );
  }

  // 2) sinônimos do thesaurus (todas as acepções)
  tasks.push(
    thesaurusLookup(baseForms(word)).then(
      ({ groups }) => {
        e.thesGroups = groups;
        const syn = groups.flatMap((g) => [g.head, ...g.words]).filter((w) => w && lower(w) !== base && !/\s{2,}/.test(w));
        e.synonyms = [...new Set([...e.synonyms, ...syn])].slice(0, 40);
      },
      () => {
        e.thesGroups = [];
      }
    )
  );
  await Promise.all(tasks);

  // 3) família (verbos e adjetivos), confirmada pelo dicionário
  const isVerb = e.classes.some((c) => /^Verbo/.test(c.name)) || (isVerbForm(base) && !e.classes.length);
  const isAdj = e.classes.some((c) => /^Adjetivo/.test(c.name));
  const single = (w) => w && !/[\s-]/.test(w) && lower(w) !== base;
  const [famVerbs, famAdjs] = await Promise.all([familyOf([word], 'verb').catch(() => []), familyOf([word], 'adj').catch(() => [])]);
  let verbs = [...new Set([...e.derived.filter(isVerbForm), ...famVerbs, ...e.synonyms.filter(isVerbForm)])].filter(single);
  let adjs = [...new Set([...famAdjs, ...e.derived.filter((w) => ADJ_STRICT.test(w)), ...(isAdj ? e.synonyms.filter((w) => !isVerbForm(w)) : e.synonyms.filter((w) => ADJ_STRICT.test(w) && !isVerbForm(w)))])].filter(single);
  // verbo: particípio também funciona como adjetivo
  if (isVerb && isVerbForm(base)) {
    const c = e.conjugation || regularConjugation(base);
    if (c && c.impessoal && c.impessoal['Particípio']) adjs = [...new Set([c.impessoal['Particípio'], ...adjs])];
  }
  // Palavras-chave do próprio significado (substantivos "de conteúdo"):
  // "saudade" → "memória ou recordação grata..." → memória, recordação
  const meaningWords = [
    ...new Set(
      e.classes
        .flatMap((c) => c.defs.slice(0, 2).map((d) => d.text))
        .join(' ')
        .toLowerCase()
        .split(/[^\p{L}]+/u)
        .filter((w) => w.length >= 5 && /(ção|são|ória|mento|ância|ência|eza|dade|ura|agem|or|ia)$/u.test(w))
    )
  ].slice(0, 5);
  // Ainda vazio: família das palavras do significado e dos sinônimos
  const moreSeeds = [...meaningWords, ...e.synonyms.slice(0, 3)];
  if ((!verbs.length || !adjs.length) && moreSeeds.length) {
    const [v2, a2] = await Promise.all([familyOf(moreSeeds, 'verb').catch(() => []), familyOf(moreSeeds, 'adj').catch(() => [])]);
    if (!verbs.length) verbs = v2.filter(single);
    if (!adjs.length) adjs = a2.filter((w) => single(w) && ADJ_STRICT.test(w));
  }
  e.relatedVerbs = verbs.slice(0, 16);
  e.relatedAdjs = adjs.slice(0, 16);

  // Sem sinônimos próprios: primeiro a família da própria palavra
  // (saudade → saudoso), depois as palavras do significado (recordação → lembrança…)
  if (!e.synonyms.length) {
    const tries = [...famAdjs.slice(0, 2).map((w) => [w, 'família']), ...famVerbs.slice(0, 2).map((w) => [w, 'família']), ...meaningWords.map((w) => [w, 'significado'])];
    for (const [f, how] of tries) {
      const { groups } = await thesaurusLookup(baseForms(f)).catch(() => ({ groups: [] }));
      // só as acepções que combinam com o significado (memória → lembrança, não "cabeça")
      const others = meaningWords.filter((w) => w !== f);
      const fits = groups.filter((g) => lower(g.head) === lower(f) || g.words.some((w) => others.includes(lower(w))));
      const use = how === 'significado' ? (fits.length ? fits : groups.slice(0, 1)) : groups;
      const syn = use.flatMap((g) => [g.head, ...g.words]).filter((w) => w && lower(w) !== base);
      if (syn.length) {
        e.synonyms = [...new Set([f, ...syn])].filter((w) => lower(w) !== base).slice(0, 30);
        e.synonymsVia = f;
        e.synonymsHow = how;
        break;
      }
    }
  }

  // 4) conjugação gerada para verbo regular sem tabela
  if (isVerb && !e.conjugation && isVerbForm(base)) e.conjugation = regularConjugation(base);

  // 5) flexões de adjetivo geradas (bonito → bonitos, bonita, bonitas)
  if (isAdj && !e.flexions.length && /o$/.test(base)) {
    const r = base.slice(0, -1);
    e.flexions = [
      { label: 'Masculino Singular', form: base },
      { label: 'Masculino Plural', form: `${r}os` },
      { label: 'Feminino Singular', form: `${r}a` },
      { label: 'Feminino Plural', form: `${r}as` }
    ];
  }

  // 6) último recurso do significado: sentidos próximos do thesaurus
  if (!e.classes.length && e.thesGroups && e.thesGroups.length) {
    e.classes = [
      {
        name: 'Sentidos próximos',
        info: 'pelo dicionário de sinônimos',
        defs: e.thesGroups.slice(0, 8).map((g) => ({ text: [g.head, ...g.words.filter((w) => lower(w) !== base).slice(0, 5)].join(', '), examples: [] }))
      }
    ];
  }
  return e;
}
