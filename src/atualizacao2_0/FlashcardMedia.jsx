// =========================================================
// FLASHCARDS — IMAGEM, ÁUDIO E VOZ EM CADA LADO DA CARTA
// FaceEditor: texto + 🖼 imagem · 🎤 gravar / 📎 enviar áudio · 🗣 voz que lê
// FaceView:   mostra a imagem e toca o áudio/voz quando o lado aparece
// =========================================================
import React, { useEffect, useRef, useState } from 'react';
import { tx } from '../i18n/index.jsx';
import { deleteMedia, putMedia, shrinkImage, useMediaUrl } from '../shared/mediaStore.js';
import { VOICE_LANGS, canSpeak, defaultVoiceLang, speak, stopSpeaking } from '../shared/tts.js';

const MAX_REC_SECONDS = 60;
const MAX_AUDIO_MB = 8;

// Campos de mídia de um lado da carta ("front" | "back")
export const sideMedia = (card, side) => ({
  img: card?.[`${side}Img`] || null,
  audio: card?.[`${side}Audio`] || null,
  voice: card?.[`${side}Voice`] || '',
  lang: card?.[`${side}Lang`] || ''
});
export const mediaToFields = (side, m) => ({
  [`${side}Img`]: m.img || null,
  [`${side}Audio`]: m.audio || null,
  [`${side}Voice`]: m.voice || null,
  [`${side}Lang`]: m.voice ? m.lang || defaultVoiceLang() : null
});
export const EMPTY_MEDIA = { img: null, audio: null, voice: '', lang: '' };

// ---------- Tocar o áudio de uma carta ----------
let current = null;
export function stopCardSound() {
  stopSpeaking();
  if (current) {
    current.pause();
    current = null;
  }
}
function playUrl(url) {
  stopCardSound();
  if (!url) return;
  const a = new Audio(url);
  current = a;
  a.play().catch(() => {});
}

// ---------- Gravador ----------
function useRecorder(onDone) {
  const [state, setState] = useState({ rec: false, secs: 0, error: '' });
  const ref = useRef(null);
  const stop = () => {
    const r = ref.current;
    if (r && r.rec.state !== 'inactive') r.rec.stop();
  };
  const start = async () => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setState({ rec: false, secs: 0, error: tx('Este aparelho não grava áudio aqui. Use 📎 para enviar um arquivo.') });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(ref.current?.timer);
        ref.current = null;
        setState({ rec: false, secs: 0, error: '' });
        if (chunks.length) onDone(new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' }));
      };
      const started = Date.now();
      const timer = setInterval(() => {
        const secs = Math.floor((Date.now() - started) / 1000);
        setState((s) => ({ ...s, secs }));
        if (secs >= MAX_REC_SECONDS) stop();
      }, 250);
      ref.current = { rec, timer };
      rec.start();
      setState({ rec: true, secs: 0, error: '' });
    } catch {
      setState({ rec: false, secs: 0, error: tx('Sem permissão para usar o microfone.') });
    }
  };
  useEffect(() => () => stop(), []);
  return { ...state, start, stop };
}

function ImageThumb({ id, onRemove }) {
  const url = useMediaUrl(id);
  if (!url) return null;
  return (
    <span className="fcm-thumb">
      <img src={url} alt="" />
      <button type="button" onClick={onRemove} title={tx('Tirar imagem')} aria-label={tx('Tirar imagem')}>
        ✕
      </button>
    </span>
  );
}

function AudioChip({ id, onRemove }) {
  const url = useMediaUrl(id);
  return (
    <span className="fcm-chip">
      <button type="button" onClick={() => playUrl(url)} title={tx('Ouvir')} disabled={!url}>
        ▶ {tx('Áudio')}
      </button>
      <button type="button" className="fcm-x" onClick={onRemove} title={tx('Tirar áudio')} aria-label={tx('Tirar áudio')}>
        ✕
      </button>
    </span>
  );
}

// =========================================================
// EDITOR DE UM LADO
// "created" guarda os arquivos novos desta edição (para apagar se cancelar)
// =========================================================
export function FaceEditor({ label, placeholder, text, onText, media, onMedia, created, inputRef, onKeyDown, autoFocus, rows = 2 }) {
  const imgInput = useRef(null);
  const audioInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch) => onMedia({ ...media, ...patch });

  const replace = (field, id) => {
    const old = media[field];
    if (old && created && created.current.has(old)) {
      deleteMedia(old);
      created.current.delete(old);
    }
    if (id && created) created.current.add(id);
    set({ [field]: id });
  };

  const addImage = async (file) => {
    if (!file || !/^image\//.test(file.type)) return;
    setBusy(true);
    try {
      const blob = await shrinkImage(file);
      replace('img', await putMedia(blob));
      setErr('');
    } catch {
      setErr(tx('Não deu para guardar a imagem.'));
    }
    setBusy(false);
  };
  const addAudio = async (blob) => {
    if (!blob) return;
    if (blob.size > MAX_AUDIO_MB * 1024 * 1024) {
      setErr(tx('Áudio grande demais (máx. {n} MB).', { n: MAX_AUDIO_MB }));
      return;
    }
    setBusy(true);
    try {
      replace('audio', await putMedia(blob));
      setErr('');
    } catch {
      setErr(tx('Não deu para guardar o áudio.'));
    }
    setBusy(false);
  };
  const recorder = useRecorder(addAudio);

  return (
    <div className="fcm-face">
      {label && <span className="fcm-label">{label}</span>}
      <textarea
        ref={inputRef}
        className="fc-input"
        rows={rows}
        placeholder={placeholder}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={(e) => {
          const file = [...(e.clipboardData?.files || [])].find((f) => /^image\//.test(f.type));
          if (file) {
            e.preventDefault();
            addImage(file);
          }
        }}
      />
      <div className="fcm-tools">
        <button type="button" className="fcm-tool" onClick={() => imgInput.current?.click()} disabled={busy} title={tx('Pôr imagem (ou cole com Ctrl+V)')}>
          🖼 {media.img ? tx('Trocar imagem') : tx('Imagem')}
        </button>
        {recorder.rec ? (
          <button type="button" className="fcm-tool rec" onClick={recorder.stop} title={tx('Parar gravação')}>
            ⏺ {tx('Parar')} {recorder.secs}s
          </button>
        ) : (
          <button type="button" className="fcm-tool" onClick={recorder.start} disabled={busy} title={tx('Gravar áudio com o microfone')}>
            🎤 {tx('Gravar')}
          </button>
        )}
        <button type="button" className="fcm-tool" onClick={() => audioInput.current?.click()} disabled={busy} title={tx('Enviar um arquivo de áudio')}>
          📎 {tx('Áudio')}
        </button>
        {canSpeak() && (
          <span className="fcm-voice" title={tx('Voz que lê o texto deste lado')}>
            🗣
            <select value={media.voice || ''} onChange={(e) => set({ voice: e.target.value, lang: media.lang || defaultVoiceLang() })}>
              <option value="">{tx('Sem voz')}</option>
              <option value="f">{tx('Voz feminina')}</option>
              <option value="m">{tx('Voz masculina')}</option>
            </select>
            {media.voice && (
              <>
                <select value={media.lang || defaultVoiceLang()} onChange={(e) => set({ lang: e.target.value })} title={tx('Idioma da voz')}>
                  {VOICE_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="fcm-tool"
                  disabled={!text.trim()}
                  onClick={() => speak(text, { gender: media.voice, lang: media.lang || defaultVoiceLang() })}
                  title={tx('Ouvir a voz')}
                >
                  ▶
                </button>
              </>
            )}
          </span>
        )}
        <input ref={imgInput} type="file" accept="image/*" hidden onChange={(e) => (addImage(e.target.files?.[0]), (e.target.value = ''))} />
        <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => (addAudio(e.target.files?.[0]), (e.target.value = ''))} />
      </div>
      {(media.img || media.audio) && (
        <div className="fcm-attached">
          {media.img && <ImageThumb id={media.img} onRemove={() => replace('img', null)} />}
          {media.audio && <AudioChip id={media.audio} onRemove={() => replace('audio', null)} />}
        </div>
      )}
      {(err || recorder.error) && <small className="fcm-error">{err || recorder.error}</small>}
    </div>
  );
}

// =========================================================
// NO ESTUDO: imagem + botões de áudio/voz (toca sozinho ao aparecer)
// =========================================================
export function FaceMedia({ card, side, active }) {
  const m = sideMedia(card, side);
  const imgUrl = useMediaUrl(m.img);
  const audioUrl = useMediaUrl(m.audio);
  const text = card[side];
  const playVoice = () => speak(text, { gender: m.voice, lang: m.lang || defaultVoiceLang() });

  // Ao aparecer: toca o áudio; se não tiver áudio, a voz lê o texto
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => {
      if (m.audio && audioUrl) playUrl(audioUrl);
      else if (m.voice && String(text || '').trim()) playVoice();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toca uma vez quando o lado aparece
  }, [active, audioUrl, card.id]);

  if (!m.img && !m.audio && !m.voice) return null;
  const stop = (fn) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };
  return (
    <>
      {imgUrl && <img className="fcm-study-img" src={imgUrl} alt="" draggable={false} />}
      {(m.audio || m.voice) && (
        <span className="fcm-study-sound">
          {m.audio && (
            <span role="button" tabIndex={0} className="fcm-play" onClick={stop(() => playUrl(audioUrl))} onKeyDown={(e) => e.key === 'Enter' && playUrl(audioUrl)}>
              🔊 {tx('Ouvir áudio')}
            </span>
          )}
          {m.voice && String(text || '').trim() && (
            <span role="button" tabIndex={0} className="fcm-play" onClick={stop(playVoice)} onKeyDown={(e) => e.key === 'Enter' && playVoice()}>
              🗣 {tx('Ler em voz alta')}
            </span>
          )}
        </span>
      )}
    </>
  );
}

// Ícones na lista de cartas
export function MediaBadges({ card }) {
  const icons = [];
  ['front', 'back'].forEach((side) => {
    const m = sideMedia(card, side);
    if (m.img) icons.push('🖼');
    if (m.audio) icons.push('🎵');
    if (m.voice) icons.push('🗣');
  });
  if (!icons.length) return null;
  return (
    <span className="fcm-badges" title={tx('Imagem / áudio / voz')}>
      {[...new Set(icons)].join(' ')}
    </span>
  );
}

// Miniatura da imagem da pergunta (lista de cartas)
export function CardThumb({ card }) {
  const url = useMediaUrl(card.frontImg || card.backImg);
  return url ? <img className="fcm-row-thumb" src={url} alt="" /> : null;
}

// =========================================================
// IMPORTAR EM LOTE COM IMAGENS E ÁUDIOS
// No texto, [nome.jpg] (ou só nome.jpg) põe o arquivo naquele lado da carta.
// Arquivos que o texto não cita viram cartas sozinhos:
//   gato.jpg + gato.mp3 → pergunta: imagem · resposta: "gato" + áudio
//   só gato.mp3          → pergunta: áudio  · resposta: "gato"
// =========================================================
const isImg = (f) => /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(f.name);
const isAudio = (f) => /^audio\//.test(f.type) || /\.(mp3|wav|ogg|oga|m4a|aac|webm|opus|flac)$/i.test(f.name);
export const isMediaFile = (f) => Boolean(f) && (isImg(f) || isAudio(f));
export const isImageFile = (f) => Boolean(f) && isImg(f);
const baseName = (name) => String(name).replace(/\.[^.]+$/, '');
const prettyName = (name) => baseName(name).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fileCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Junta o texto já reconhecido (parseBulk) com os arquivos — sem salvar nada ainda
export function planBulk(parsed, files) {
  const list = [...files];
  const used = new Set();
  const take = (text) => {
    let out = String(text || '');
    const found = { img: null, audio: null };
    list.forEach((f) => {
      const name = escRe(f.name);
      const re = new RegExp(`\\[\\s*${name}\\s*\\]|(^|[\\s(])${name}(?=$|[\\s),.;!?])`, 'gi');
      if (!re.test(out)) return;
      re.lastIndex = 0;
      out = out.replace(re, (m, pre) => (pre && !m.startsWith('[') ? pre : ' '));
      const kind = isImg(f) ? 'img' : 'audio';
      if (!found[kind]) found[kind] = f;
      used.add(f);
    });
    return { text: out.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim(), ...found };
  };
  const cards = parsed.map((c) => {
    const f = take(c.front);
    const b = take(c.back);
    return { front: f.text, back: b.text, frontFile: f.img, frontAudioFile: f.audio, backFile: b.img, backAudioFile: b.audio };
  });
  // os que sobraram: agrupa por nome (gato.jpg + gato.mp3)
  const groups = new Map();
  list
    .filter((f) => !used.has(f))
    .sort((a, b) => fileCollator.compare(a.name, b.name))
    .forEach((f) => {
      const k = baseName(f.name).toLowerCase();
      if (!groups.has(k)) groups.set(k, { name: f.name, img: null, audio: null });
      const g = groups.get(k);
      if (isImg(f) && !g.img) g.img = f;
      else if (isAudio(f) && !g.audio) g.audio = f;
    });
  groups.forEach((g) => {
    if (g.img) cards.push({ front: '', back: prettyName(g.name), frontFile: g.img, frontAudioFile: null, backFile: null, backAudioFile: g.audio });
    else if (g.audio) cards.push({ front: '', back: prettyName(g.name), frontFile: null, frontAudioFile: g.audio, backFile: null, backAudioFile: null });
  });
  const ok = (text, img, audio) => Boolean(String(text || '').trim() || img || audio);
  return {
    cards: cards.filter((c) => ok(c.front, c.frontFile, c.frontAudioFile) && ok(c.back, c.backFile, c.backAudioFile)),
    used
  };
}

// Salva os arquivos no aparelho e devolve as cartas prontas para addCards
export async function materializeBulk(plan, voice = {}) {
  const save = async (f) => (f ? putMedia(isImg(f) ? await shrinkImage(f) : f) : null);
  const out = [];
  for (const c of plan.cards) {
    out.push({
      front: c.front,
      back: c.back,
      frontImg: await save(c.frontFile),
      frontAudio: await save(c.frontAudioFile),
      backImg: await save(c.backFile),
      backAudio: await save(c.backAudioFile),
      ...(voice.front ? { frontVoice: voice.front, frontLang: voice.frontLang || defaultVoiceLang() } : null),
      ...(voice.back ? { backVoice: voice.back, backLang: voice.backLang || defaultVoiceLang() } : null)
    });
  }
  return out;
}

// Seletor de voz + idioma (reaproveitado no lote e na seleção)
export function VoicePicker({ voice, lang, onChange }) {
  return (
    <span className="fcm-voice">
      <select value={voice || ''} onChange={(e) => onChange({ voice: e.target.value, lang: lang || defaultVoiceLang() })}>
        <option value="">{tx('Sem voz')}</option>
        <option value="f">{tx('Voz feminina')}</option>
        <option value="m">{tx('Voz masculina')}</option>
      </select>
      {voice && (
        <select value={lang || defaultVoiceLang()} onChange={(e) => onChange({ voice, lang: e.target.value })} title={tx('Idioma da voz')}>
          {VOICE_LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}

// =========================================================
// MÍDIA NAS CARTAS SELECIONADAS ("Selecionar etapas")
// voz (com idioma), áudio para todas, um áudio por carta, gravar em sequência
// =========================================================
export function SelectionMedia({ cards, onUpdate, click, flash }) {
  const [side, setSide] = useState('front');
  const [voice, setVoice] = useState({ voice: 'f', lang: defaultVoiceLang() });
  const [busy, setBusy] = useState(false);
  const [seq, setSeq] = useState(null); // índice da carta na gravação em sequência
  const fileRef = useRef(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const n = cards.length;
  const sideName = side === 'front' ? tx('Pergunta') : tx('Resposta');
  const A = `${side}Audio`;
  const say = (m) => flash && flash(m);
  const sound = (k) => click && click(k);

  // troca o áudio de uma carta (o antigo sai do aparelho)
  const setAudio = async (card, blob) => {
    const id = blob ? await putMedia(blob) : null;
    if (card[A]) deleteMedia(card[A]);
    onUpdate(card.id, { [A]: id });
  };

  const applyVoice = () => {
    if (!n) return;
    sound('train');
    cards.forEach((c) => onUpdate(c.id, { [`${side}Voice`]: voice.voice || null, [`${side}Lang`]: voice.voice ? voice.lang || defaultVoiceLang() : null }));
    say(voice.voice ? tx('Voz aplicada em {n} carta(s) ({s})', { s: sideName, n }) : tx('Voz tirada de {n} carta(s)', { n }));
  };
  const testVoice = () => {
    const c = cards.find((x) => String(x[side] || '').trim());
    speak(c ? c[side] : sideName, { gender: voice.voice || 'f', lang: voice.lang || defaultVoiceLang() });
  };

  const onFiles = async (files) => {
    const list = [...(files || [])].filter(isAudio).sort((a, b) => fileCollator.compare(a.name, b.name));
    if (!list.length || !n) return;
    if (list.some((f) => f.size > MAX_AUDIO_MB * 1024 * 1024)) {
      say(tx('Áudio grande demais (máx. {n} MB).', { n: MAX_AUDIO_MB }));
      return;
    }
    setBusy(true);
    try {
      if (list.length === 1) {
        for (const c of cards) await setAudio(c, list[0]);
        say(tx('Áudio posto em {n} carta(s) ({s})', { s: sideName, n }));
      } else {
        const m = Math.min(list.length, n);
        for (let i = 0; i < m; i += 1) await setAudio(cards[i], list[i]);
        say(tx('{m} áudio(s) postos um por carta, na ordem', { m }));
      }
      sound('train');
    } finally {
      setBusy(false);
    }
  };
  const oneForAll = useRecorder(async (blob) => {
    setBusy(true);
    try {
      const list = cardsRef.current;
      for (const c of list) await setAudio(c, blob);
      sound('train');
      say(tx('Gravação posta em {n} carta(s) ({s})', { s: sideName, n: list.length }));
    } finally {
      setBusy(false);
    }
  });
  const removeAudio = () => {
    const list = cards.filter((c) => c[A]);
    if (!list.length) return;
    list.forEach((c) => {
      deleteMedia(c[A]);
      onUpdate(c.id, { [A]: null });
    });
    sound('click');
    say(tx('Áudio tirado de {n} carta(s)', { n: list.length }));
  };
  const withAudio = cards.filter((c) => c[A]).length;
  const withVoice = cards.filter((c) => c[`${side}Voice`]).length;

  return (
    <div className="fcm-sel">
      <div className="fcm-sel-row">
        <b>{tx('Mídia nas selecionadas')}</b>
        <span className="fcm-seg">
          {[
            ['front', tx('Pergunta')],
            ['back', tx('Resposta')]
          ].map(([k, label]) => (
            <button key={k} type="button" className={side === k ? 'on' : ''} onClick={() => setSide(k)}>
              {label}
            </button>
          ))}
        </span>
        <small className="fcm-sel-info">{tx('{a} com áudio · {v} com voz', { a: withAudio, v: withVoice })}</small>
      </div>
      <div className="fcm-sel-row">
        <span className="fcm-sel-label">🗣 {tx('Voz')}</span>
        <VoicePicker voice={voice.voice} lang={voice.lang} onChange={setVoice} />
        <button type="button" className="fcm-tool" onClick={testVoice} title={tx('Ouvir a voz')}>
          ▶
        </button>
        <button type="button" className="fc-btn small" disabled={!n} onClick={applyVoice}>
          {voice.voice ? tx('Aplicar voz em {n}', { n }) : tx('Tirar voz de {n}', { n })}
        </button>
      </div>
      <div className="fcm-sel-row">
        <span className="fcm-sel-label">🎵 {tx('Áudio')}</span>
        <button type="button" className="fcm-tool" disabled={!n || busy} onClick={() => fileRef.current?.click()} title={tx('1 arquivo = o mesmo em todas · vários = um por carta, na ordem')}>
          📎 {tx('Enviar áudio(s)')}
        </button>
        {oneForAll.rec ? (
          <button type="button" className="fcm-tool rec" onClick={oneForAll.stop}>
            ⏺ {tx('Parar')} {oneForAll.secs}s
          </button>
        ) : (
          <button type="button" className="fcm-tool" disabled={!n || busy} onClick={oneForAll.start} title={tx('Uma gravação só, posta em todas as selecionadas')}>
            🎤 {tx('Gravar para todas')}
          </button>
        )}
        <button type="button" className="fcm-tool" disabled={!n || busy} onClick={() => (sound('click'), setSeq(0))} title={tx('Grava uma carta depois da outra')}>
          🎙 {tx('Gravar uma a uma')}
        </button>
        <button type="button" className="fcm-tool" disabled={!withAudio} onClick={removeAudio}>
          ✕ {tx('Tirar áudio')}
        </button>
        <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
      </div>
      {oneForAll.error && <small className="fcm-error">{oneForAll.error}</small>}
      {seq !== null && cards[seq] && (
        <SequenceRecorder cards={cards} index={seq} side={side} onIndex={setSeq} onSave={setAudio} onClose={() => setSeq(null)} click={click} />
      )}
    </div>
  );
}

// Grava carta por carta: mostra o texto, grava, salva e pula para a próxima
function SequenceRecorder({ cards, index, side, onIndex, onSave, onClose, click }) {
  const card = cards[index];
  const cardRef = useRef(card);
  cardRef.current = card;
  const idxRef = useRef(index);
  idxRef.current = index;
  const [saving, setSaving] = useState(false);
  const rec = useRecorder(async (blob) => {
    setSaving(true);
    await onSave(cardRef.current, blob);
    setSaving(false);
    if (click) click('train');
    // vai sozinho para a próxima
    if (idxRef.current < cards.length - 1) setTimeout(() => onIndex(idxRef.current + 1), 350);
  });
  const audioUrl = useMediaUrl(card[`${side}Audio`]);
  const imgUrl = useMediaUrl(card[`${side}Img`]);
  const text = String(card[side] || '').trim();
  const go = (d) => {
    if (rec.rec) rec.stop();
    onIndex(Math.max(0, Math.min(cards.length - 1, index + d)));
  };
  const done = cards.filter((c) => c[`${side}Audio`]).length;
  return (
    <div className="fcm-seq">
      <div className="fcm-seq-top">
        <b>
          🎙 {tx('Carta {i} de {n}', { i: index + 1, n: cards.length })} · {side === 'front' ? tx('Pergunta') : tx('Resposta')}
        </b>
        <small>{tx('{d} de {n} com áudio', { d: done, n: cards.length })}</small>
        <button
          type="button"
          className="fcm-tool"
          onClick={() => {
            if (rec.rec) rec.stop();
            onClose();
          }}
        >
          {tx('Fechar')}
        </button>
      </div>
      <div className="fcm-seq-card">
        {imgUrl && <img src={imgUrl} alt="" />}
        <span>{text || (side === 'front' ? card.back : card.front) || '—'}</span>
      </div>
      <div className="fcm-seq-actions">
        <button type="button" className="fcm-tool" disabled={index === 0} onClick={() => go(-1)}>
          ◀ {tx('Anterior')}
        </button>
        {rec.rec ? (
          <button type="button" className="fc-btn small fcm-rec-big rec" onClick={rec.stop}>
            ⏹ {tx('Parar e salvar')} {rec.secs}s
          </button>
        ) : (
          <button type="button" className="fc-btn primary small fcm-rec-big" disabled={saving} onClick={rec.start}>
            ⏺ {card[`${side}Audio`] ? tx('Gravar de novo') : tx('Gravar')}
          </button>
        )}
        <button type="button" className="fcm-tool" disabled={!audioUrl || rec.rec} onClick={() => playUrl(audioUrl)}>
          ▶ {tx('Ouvir')}
        </button>
        <button type="button" className="fcm-tool" disabled={index === cards.length - 1} onClick={() => go(1)}>
          {tx('Próxima')} ▶
        </button>
      </div>
      {rec.error && <small className="fcm-error">{rec.error}</small>}
    </div>
  );
}
