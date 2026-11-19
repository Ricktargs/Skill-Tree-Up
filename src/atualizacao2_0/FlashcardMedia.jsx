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
