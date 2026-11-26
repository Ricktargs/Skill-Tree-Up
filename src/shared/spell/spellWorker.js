// =========================================================
// CORRETOR ORTOGRÁFICO (roda em segundo plano, sem travar a tela)
// Motor: Hunspell (o mesmo do LibreOffice/Firefox) compilado para WebAssembly.
// Dicionários: português (Brasil), inglês e espanhol — baixados UMA vez
// (jsDelivr, versão fixa) e guardados no aparelho (IndexedDB). Depois
// funciona sem internet.
// =========================================================
import './workerEnv.js';
// núcleo do Hunspell em WebAssembly (o .wasm vem embutido no próprio arquivo)
import createHunspellModule from 'hunspell-asm/dist/cjs/lib/browser/hunspell.js';

const CDN = 'https://cdn.jsdelivr.net/npm/';
const DICTS = {
  pt: 'dictionary-pt@4.0.0',
  en: 'dictionary-en@4.0.0',
  es: 'dictionary-es@4.0.0'
};
const DB = 'orbe-spell-v1';

// ---------- guardar no aparelho ----------
const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
const dbGet = async (key) => {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const r = db.transaction('files').objectStore('files').get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};
const dbPut = async (key, value) => {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {
    /* sem espaço: baixa de novo na próxima */
  }
};
const getFile = async (lang, ext) => {
  const key = `${DICTS[lang]}/index.${ext}`;
  const cached = await dbGet(key);
  if (cached) return new Uint8Array(cached);
  const res = await fetch(`${CDN}${key}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  await dbPut(key, buf);
  return new Uint8Array(buf);
};

// ---------- motor ----------
// Carrega o módulo uma vez. (O módulo tem um "then" próprio: por isso vai
// dentro de um objeto, senão a Promise ficaria esperando ele para sempre.)
let engineP = null;
const getEngine = () => {
  if (!engineP) {
    engineP = new Promise((resolve, reject) => {
      const m = createHunspellModule({
        onRuntimeInitialized: () => resolve({ m }),
        onAbort: (why) => reject(new Error(String(why || 'abort'))),
        print: () => {},
        printErr: () => {}
      });
    }).then(({ m }) => {
      const api = {
        create: m.cwrap('Hunspell_create', 'number', ['number', 'number']),
        spell: m.cwrap('Hunspell_spell', 'number', ['number', 'number']),
        suggest: m.cwrap('Hunspell_suggest', 'number', ['number', 'number', 'number']),
        freeList: m.cwrap('Hunspell_free_list', null, ['number', 'number', 'number']),
        add: m.cwrap('Hunspell_add', 'number', ['number', 'number'])
      };
      m.FS.mkdir('/dic');
      // chama uma função do Hunspell com textos (aloca e libera a memória)
      const withStr = (strs, fn) => {
        const ptrs = strs.map((s) => m.allocateUTF8(String(s).normalize()));
        try {
          return fn(...ptrs);
        } finally {
          ptrs.forEach((p) => m._free(p));
        }
      };
      return {
        load(lang, aff, dic) {
          m.FS.writeFile(`/dic/${lang}.aff`, aff);
          m.FS.writeFile(`/dic/${lang}.dic`, dic);
          const h = withStr([`/dic/${lang}.aff`, `/dic/${lang}.dic`], (a, d) => api.create(a, d));
          return {
            spell: (w) => withStr([w], (p) => api.spell(h, p)) !== 0,
            suggest: (w) => {
              const listPtr = m._malloc(4);
              try {
                const n = withStr([w], (p) => api.suggest(h, listPtr, p));
                const base = m.getValue(listPtr, '*');
                const out = [];
                for (let i = 0; i < n; i++) out.push(m.UTF8ToString(m.getValue(base + i * 4, '*')));
                api.freeList(h, listPtr, n);
                return out;
              } finally {
                m._free(listPtr);
              }
            },
            addWord: (w) => withStr([w], (p) => api.add(h, p))
          };
        }
      };
    });
  }
  return engineP;
};
const checkers = {}; // lang -> hunspell
const loading = {}; // lang -> Promise
let personal = new Set();

const loadLang = (lang) => {
  if (!DICTS[lang]) return Promise.resolve(null);
  if (!loading[lang]) {
    loading[lang] = (async () => {
      const engine = await getEngine();
      const [aff, dic] = await Promise.all([getFile(lang, 'aff'), getFile(lang, 'dic')]);
      const sp = engine.load(lang, aff, dic);
      personal.forEach((w) => sp.addWord(w));
      checkers[lang] = sp;
      return sp;
    })().catch((err) => {
      delete loading[lang];
      throw err;
    });
  }
  return loading[lang];
};

const clean = (w) => String(w || '').trim();

// ---------- Thesaurus (sinônimos) do LibreOffice — pt-BR, LGPL/MPL ----------
// Baixado só quando o Dicionário ORBE é aberto pela primeira vez.
const THES_URL = 'https://cdn.jsdelivr.net/gh/LibreOffice/dictionaries@79195b017e6d70151337856c59e7d13d311d6630/pt_BR/th_pt_BR.dat';
let thesP = null;
const loadThesaurus = () => {
  if (!thesP) {
    thesP = (async () => {
      const key = THES_URL;
      let buf = await dbGet(key);
      if (!buf) {
        const res = await fetch(THES_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buf = await res.arrayBuffer();
        await dbPut(key, buf);
      }
      const text = new TextDecoder('utf-8').decode(buf);
      const lines = text.split('\n');
      const map = new Map();
      // formato: "palavra|n" e depois n linhas "(Sinônimo)cabeça|cabeça|sin1|sin2..."
      for (let i = 1; i < lines.length; i++) {
        const head = lines[i];
        const bar = head.lastIndexOf('|');
        if (bar < 1) continue;
        const n = parseInt(head.slice(bar + 1), 10);
        if (!(n > 0)) continue;
        const word = head.slice(0, bar).toLowerCase();
        const groups = [];
        for (let k = 1; k <= n && i + k < lines.length; k++) {
          const parts = lines[i + k].replace(/^\([^)]*\)/, '').split('|').map((x) => x.trim()).filter(Boolean);
          if (parts.length) groups.push({ head: parts[0], words: [...new Set(parts.slice(1))] });
        }
        if (!map.has(word)) map.set(word, groups);
        i += n;
      }
      return map;
    })().catch((err) => {
      thesP = null;
      throw err;
    });
  }
  return thesP;
};

// distância entre palavras (letra trocada de lugar conta como 1 erro)
const distance = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
};

self.onmessage = async (e) => {
  const { id, type } = e.data || {};
  try {
    if (type === 'init') {
      personal = new Set(e.data.personal || []);
      const langs = e.data.langs || ['pt', 'en', 'es'];
      // um de cada vez (o primeiro é o idioma do programa)
      for (const l of langs) {
        try {
          await loadLang(l);
          self.postMessage({ type: 'ready', lang: l });
        } catch (err) {
          self.postMessage({ type: 'error', lang: l, message: String((err && err.message) || err) });
        }
      }
      return;
    }
    if (type === 'add') {
      const w = clean(e.data.word);
      if (w) {
        personal.add(w);
        Object.values(checkers).forEach((sp) => sp.addWord(w));
      }
      self.postMessage({ id, ok: true });
      return;
    }
    if (type === 'thes') {
      // sinônimos: primeira chave que existir (palavra, singular, masculino...)
      const map = await loadThesaurus();
      const keys = (e.data.keys || []).map((k) => String(k).toLowerCase());
      const found = keys.find((k) => map.has(k));
      self.postMessage({ id, key: found || null, groups: found ? map.get(found) : [] });
      return;
    }
    if (type === 'validate') {
      // quais destas palavras existem de verdade (dicionário do corretor)
      const langs = e.data.langs || ['pt'];
      await loadLang(langs[0]);
      const sp = checkers[langs[0]];
      const words = [...new Set(e.data.words || [])];
      self.postMessage({ id, valid: sp ? words.filter((w) => sp.spell(w)) : [] });
      return;
    }
    if (type === 'check') {
      const word = clean(e.data.word);
      const langs = e.data.langs || ['pt', 'en', 'es'];
      // espera o idioma principal (o resto, se já estiver pronto)
      try {
        await loadLang(langs[0]);
      } catch (err) {
        self.postMessage({ id, error: String((err && err.message) || err) });
        return;
      }
      const ready = langs.map((l) => checkers[l]).filter(Boolean);
      if (!word || personal.has(word) || ready.some((sp) => sp.spell(word))) {
        self.postMessage({ id, ok: true, suggestions: [] });
        return;
      }
      // Ordem dos idiomas: primeiro o das palavras ao redor (a frase); sem
      // frase clara, o que tiver a sugestão mais parecida com o que foi digitado
      const ctxWords = String(e.data.context || '')
        .split(/[^\p{L}\p{M}'’-]+/u)
        .filter((w) => w.length > 1 && w !== word)
        .slice(0, 40);
      const lists = langs
        .map((l, i) => ({ l, i, sp: checkers[l] }))
        .filter((x) => x.sp)
        .map((x) => {
          const list = x.sp.suggest(word);
          const best = list.length ? Math.min(...list.slice(0, 3).map((s2) => distance(word.toLowerCase(), s2.toLowerCase()))) : 99;
          const known = ctxWords.filter((w) => x.sp.spell(w)).length;
          return { ...x, list, best, known };
        });
      const ctxClear = ctxWords.length >= 2;
      lists.sort((x, y) => (ctxClear ? y.known - x.known : 0) || x.best - y.best || x.i - y.i);
      const suggestions = [...new Set(lists.flatMap((x) => x.list))].slice(0, 5);
      self.postMessage({ id, ok: false, suggestions });
    }
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
