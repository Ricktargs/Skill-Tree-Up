// =========================================================
// 📖 DICIONÁRIO ORBE — janela vertical (aberta pelo botão direito numa
// palavra escrita certa → "+Dicionário ORBE")
// Abas: Significado · Sinônimos · Verbos · Adjetivos
// =========================================================
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { lookupWord, looksAdjective, looksVerb } from './dictionaryOrbe.js';
import { useFloatingWindow, useIsMobile } from '../useFloatingWindow.js';
import './DictionaryWindow.css';

export const openDictionary = (word) => window.dispatchEvent(new CustomEvent('orbe-dictionary', { detail: { word } }));

const TABS = [
  ['meaning', 'Significado'],
  ['syn', 'Sinônimos'],
  ['verbs', 'Verbos'],
  ['adj', 'Adjetivos']
];
const PERSONS = ['eu', 'tu', 'ele/ela', 'nós', 'vós', 'eles/elas'];

function Chips({ words, onOpen, kind = '' }) {
  return (
    <div className="dic-chips">
      {words.map((w) => (
        <button key={w} type="button" className={`dic-chip ${kind}`} onClick={() => onOpen(w)} title={`Abrir “${w}” no dicionário`}>
          {w}
        </button>
      ))}
    </div>
  );
}

function Empty({ children }) {
  return <p className="dic-empty">{children}</p>;
}

function Meaning({ entry }) {
  if (!entry.classes.length) return <Empty>Sem significado registrado para esta palavra.</Empty>;
  return entry.classes.map((c, ci) => (
    <section key={ci} className="dic-class">
      <h4>
        <span className="dic-class-name">{c.name}</span>
        {c.info && <small>{c.info}</small>}
      </h4>
      <ol>
        {c.defs.slice(0, 8).map((d, i) => (
          <li key={i}>
            <span className="dic-def">{d.text}</span>
            {d.examples.map((ex, j) => (
              <q key={j} className="dic-example">
                {ex}
              </q>
            ))}
          </li>
        ))}
      </ol>
    </section>
  ));
}

function Synonyms({ entry, onOpen }) {
  if (!entry.synonyms.length && !entry.antonyms.length) return <Empty>Nenhum sinônimo registrado para esta palavra.</Empty>;
  return (
    <>
      {entry.synonyms.length > 0 && (
        <section className="dic-class">
          <h4>
            <span className="dic-class-name">Sinônimos</span>
            {entry.synonymsVia && (
              <small>
                {entry.synonymsHow === 'significado' ? 'pelo significado' : 'pela família da palavra'} (“{entry.synonymsVia}”)
              </small>
            )}
          </h4>
          <Chips words={entry.synonyms} onOpen={onOpen} />
        </section>
      )}
      {entry.antonyms.length > 0 && (
        <section className="dic-class">
          <h4>
            <span className="dic-class-name anti">Antônimos</span>
          </h4>
          <Chips words={entry.antonyms} onOpen={onOpen} kind="anti" />
        </section>
      )}
    </>
  );
}

function Verbs({ entry, onOpen }) {
  const conj = entry.conjugation;
  const tempos = conj ? conj.tempos : [];
  const [ti, setTi] = useState(0);
  // forma de outro verbo (ex.: "casa" é forma de "casar")
  const formOfVerb = entry.classes
    .filter((c) => /^Forma verbal/.test(c.name))
    .map((c) => (c.defs[0]?.text.match(/do verbo\s+([\p{L}-]+)/u) || [])[1])
    .filter(Boolean);
  const related = (entry.relatedVerbs || entry.derived.filter(looksVerb)).filter((w) => !formOfVerb.includes(w));
  if (!conj && !formOfVerb.length && !related.length) return <Empty>Nenhum verbo encontrado para esta palavra.</Empty>;
  const t = tempos[Math.min(ti, tempos.length - 1)];
  return (
    <>
      {conj && (
        <section className="dic-class">
          <h4>
            <span className="dic-class-name">Conjugação</span>
            {conj.generated && <small>conjugação regular</small>}
          </h4>
          <div className="dic-imp">
            {Object.entries(conj.impessoal)
              .slice(0, 3)
              .map(([k, v]) => (
                <div key={k}>
                  <small>{k.replace(' impessoal', '')}</small>
                  <b>{v}</b>
                </div>
              ))}
          </div>
          {tempos.length > 0 && (
            <>
              <select className="dic-tense" value={ti} onChange={(e) => setTi(Number(e.target.value))}>
                {tempos.map((x, i) => (
                  <option key={i} value={i}>
                    {x.modo ? `${x.modo} · ` : ''}
                    {x.tempo}
                  </option>
                ))}
              </select>
              <table className="dic-conj">
                <tbody>
                  {t.formas.map((f, i) => (
                    <tr key={i}>
                      <th>{PERSONS[i]}</th>
                      <td>{f || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}
      {formOfVerb.length > 0 && (
        <section className="dic-class">
          <h4>
            <span className="dic-class-name">Também é forma do verbo</span>
          </h4>
          <Chips words={[...new Set(formOfVerb)]} onOpen={onOpen} />
        </section>
      )}
      {related.length > 0 && (
        <section className="dic-class">
          <h4>
            <span className="dic-class-name">{conj ? 'Verbos da mesma família' : 'Verbos relacionados'}</span>
          </h4>
          <Chips words={related} onOpen={onOpen} />
        </section>
      )}
    </>
  );
}

function Adjectives({ entry, onOpen }) {
  const adj = entry.classes.find((c) => /^Adjetivo/.test(c.name));
  const related = entry.relatedAdjs || [...entry.derived, ...entry.synonyms].filter(looksAdjective);
  if (!adj && !related.length) return <Empty>Nenhum adjetivo encontrado para esta palavra.</Empty>;
  return (
    <>
      {adj && (
        <section className="dic-class">
          <h4>
            <span className="dic-class-name">Como adjetivo</span>
          </h4>
          {entry.flexions.length > 0 && (
            <div className="dic-flex">
              {entry.flexions.map((f) => (
                <div key={f.label}>
                  <small>{f.label}</small>
                  <b>{f.form}</b>
                </div>
              ))}
            </div>
          )}
          <ol>
            {adj.defs.slice(0, 6).map((d, i) => (
              <li key={i}>
                <span className="dic-def">{d.text}</span>
                {d.examples.map((ex, j) => (
                  <q key={j} className="dic-example">
                    {ex}
                  </q>
                ))}
              </li>
            ))}
          </ol>
        </section>
      )}
      {related.length > 0 && (
        <section className="dic-class">
          <h4>
            <span className="dic-class-name">{adj ? 'Outros adjetivos parecidos' : 'Adjetivos relacionados'}</span>
          </h4>
          <Chips words={[...new Set(related)]} onOpen={onOpen} />
        </section>
      )}
    </>
  );
}

export function DictionaryHost() {
  const [word, setWord] = useState(null);
  const [history, setHistory] = useState([]);
  const [state, setState] = useState({ loading: false });
  const [tab, setTab] = useState('meaning');
  const ref = useRef(null);
  const isMobile = useIsMobile();
  const fw = useFloatingWindow('orbe-dict-window', { disabled: isMobile, minW: 300, minH: 360 });

  useEffect(() => {
    const on = (e) => {
      const w = e.detail && e.detail.word;
      if (!w) return;
      setHistory([]);
      setTab('meaning');
      setWord(w);
    };
    window.addEventListener('orbe-dictionary', on);
    return () => window.removeEventListener('orbe-dictionary', on);
  }, []);

  useEffect(() => {
    if (!word) return undefined;
    let alive = true;
    setState({ loading: true });
    lookupWord(word).then(
      (r) => alive && setState({ loading: false, result: r }),
      () => alive && setState({ loading: false, error: true })
    );
    return () => {
      alive = false;
    };
  }, [word]);

  useEffect(() => {
    if (!word) return undefined;
    const key = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setWord(null);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [word]);

  if (!word) return null;
  const openWord = (w) => {
    setHistory((h) => [...h, word]);
    setTab('meaning');
    setWord(w);
  };
  const back = () => {
    const h = [...history];
    const prev = h.pop();
    setHistory(h);
    if (prev) setWord(prev);
  };
  const r = state.result;
  const entry = r && !r.missing ? r.entry : null;
  const title = r && r.base ? r.base : (r && r.word) || word;

  return createPortal(
    <div ref={ref} className="dic-window" style={fw.style} role="dialog" aria-label="Dicionário ORBE">
      <header className="dic-head" onPointerDown={(e) => fw.start(e, 'move', ref.current)} onDoubleClick={() => fw.reset()}>
        <div className="dic-brand">
          {history.length > 0 && (
            <button type="button" className="dic-icon" onClick={back} title="Voltar para a palavra anterior">
              ←
            </button>
          )}
          <span>📖 Dicionário ORBE</span>
          <button type="button" className="dic-icon" onClick={() => setWord(null)} title="Fechar (Esc)" aria-label="Fechar">
            ✕
          </button>
        </div>
        <h3 className="dic-word">{title}</h3>
        {r && r.base && (
          <p className="dic-formof">
            “{r.word}” é {r.formInfo ? r.formInfo.replace(/\s*do verbo\s+[\p{L}-]+$/u, '') : 'uma forma'} de <b>{r.base}</b>
          </p>
        )}
        {entry && entry.classes.length > 0 && (
          <div className="dic-tags">
            {[...new Set(entry.classes.map((c) => c.name))].map((n) => (
              <span key={n}>{n}</span>
            ))}
            {entry.lang !== 'Português' && <span className="lang">{entry.lang}</span>}
          </div>
        )}
      </header>

      <nav className="dic-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <div className="dic-body">
        {state.loading && (
          <div className="dic-loading">
            <span className="dic-spin" aria-hidden="true" />
            Procurando “{word}”…
          </div>
        )}
        {state.error && <Empty>Não deu para buscar agora. Confira a internet e tente de novo.</Empty>}
        {r && r.missing && <Empty>“{word}” não foi encontrada no dicionário.</Empty>}
        {entry && tab === 'meaning' && <Meaning entry={entry} />}
        {entry && tab === 'syn' && <Synonyms entry={entry} onOpen={openWord} />}
        {entry && tab === 'verbs' && <Verbs key={title} entry={entry} onOpen={openWord} />}
        {entry && tab === 'adj' && <Adjectives entry={entry} onOpen={openWord} />}
      </div>

      <footer className="dic-foot">
        Fonte:{' '}
        <a href={`https://pt.wiktionary.org/wiki/${encodeURIComponent(title)}`} target="_blank" rel="noreferrer">
          Wikcionário
        </a>{' '}
        (CC BY-SA)
      </footer>
    </div>,
    document.body
  );
}
