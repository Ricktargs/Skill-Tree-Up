// =========================================================
// VOZ QUE LÊ O TEXTO (flashcards)
// Navegador / PC: vozes do sistema (Google, Microsoft, Apple…)
// App Android: plugin nativo de voz do celular.
// "f" = feminina · "m" = masculina. Quando o aparelho só tem uma voz
// no idioma, o tom muda para diferenciar (mais grave = masculina).
// =========================================================
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export const VOICE_LANGS = [
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'pt-PT', label: 'Português (Portugal)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Español (España)' },
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'nl-NL', label: 'Nederlands' },
  { code: 'sv-SE', label: 'Svenska' },
  { code: 'pl-PL', label: 'Polski' },
  { code: 'ru-RU', label: 'Русский' },
  { code: 'uk-UA', label: 'Українська' },
  { code: 'tr-TR', label: 'Türkçe' },
  { code: 'el-GR', label: 'Ελληνικά' },
  { code: 'ar-SA', label: 'العربية' },
  { code: 'he-IL', label: 'עברית' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'id-ID', label: 'Bahasa Indonesia' },
  { code: 'th-TH', label: 'ไทย' },
  { code: 'vi-VN', label: 'Tiếng Việt' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'zh-CN', label: '中文 (普通话)' },
  { code: 'zh-TW', label: '中文 (台灣)' }
];

// idioma padrão = o do programa
export const defaultVoiceLang = () => {
  const l = (typeof document !== 'undefined' && document.documentElement.lang) || 'pt-BR';
  const hit = VOICE_LANGS.find((v) => v.code.toLowerCase() === l.toLowerCase()) || VOICE_LANGS.find((v) => v.code.slice(0, 2) === l.slice(0, 2));
  return hit ? hit.code : 'pt-BR';
};

const FEMALE = /female|feminin|mulher|woman|maria|francisca|luciana|vit[oó]ria|helena|thalita|leila|zira|samantha|susan|hazel|karen|moira|tessa|monica|paulina|elsa|alice|amelie|anna|sabina|kyoko|haruka|ayumi|nanami|huihui|yaoyao|xiaoxiao|ting-ting|google (português|español|italiano|français|deutsch|日本語|普通话)/i;
const MALE = /\bmale\b|masculin|homem|\bman\b|daniel|antonio|ant[oô]nio|felipe|ricardo|donato|fabio|julio|david|mark|guy|george|james|alex|diego|jorge|pablo|cosimo|luca|thomas|paul|stefan|ichiro|keita|otoya|kangkang|yunyang|google uk english male/i;

let voicesCache = [];
const loadVoices = () => {
  if (typeof speechSynthesis === 'undefined') return [];
  voicesCache = speechSynthesis.getVoices() || [];
  return voicesCache;
};
if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

function pickVoice(lang, gender) {
  const all = voicesCache.length ? voicesCache : loadVoices();
  const base = lang.slice(0, 2).toLowerCase();
  const same = all.filter((v) => (v.lang || '').toLowerCase().replace('_', '-') === lang.toLowerCase());
  const near = same.length ? same : all.filter((v) => (v.lang || '').toLowerCase().startsWith(base));
  if (!near.length) return { voice: null, pitch: gender === 'm' ? 0.75 : 1.1 };
  const want = gender === 'm' ? MALE : FEMALE;
  const avoid = gender === 'm' ? FEMALE : MALE;
  // prefere as vozes do Google, depois as que parecem do gênero pedido
  const ranked = [...near].sort((a, b) => {
    const score = (v) => (want.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) - (avoid.test(v.name) ? 5 : 0) + (v.localService ? 0 : 1);
    return score(b) - score(a);
  });
  const best = ranked[0];
  const genderOk = want.test(best.name) && !(gender === 'm' && FEMALE.test(best.name));
  // não achou a voz do gênero: usa a melhor e muda o tom
  return { voice: best, pitch: genderOk ? 1 : gender === 'm' ? 0.72 : 1.15 };
}

const isNativeApp = () => {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  return Boolean(cap && cap.isNativePlatform && cap.isNativePlatform());
};

export function stopSpeaking() {
  try {
    if (isNativeApp()) TextToSpeech.stop();
    else if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  } catch {
    /* nada falando */
  }
}

export async function speak(text, { gender = 'f', lang } = {}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  const l = lang || defaultVoiceLang();
  stopSpeaking();
  if (isNativeApp()) {
    try {
      await TextToSpeech.speak({ text: clean, lang: l, rate: 1, pitch: gender === 'm' ? 0.75 : 1.1, volume: 1, category: 'playback' });
    } catch {
      /* celular sem voz para esse idioma */
    }
    return;
  }
  if (typeof speechSynthesis === 'undefined') return;
  const u = new SpeechSynthesisUtterance(clean);
  const { voice, pitch } = pickVoice(l, gender);
  if (voice) u.voice = voice;
  u.lang = voice ? voice.lang : l;
  u.pitch = pitch;
  u.rate = 1;
  u.volume = 1;
  speechSynthesis.speak(u);
}

export const canSpeak = () => isNativeApp() || typeof speechSynthesis !== 'undefined';
