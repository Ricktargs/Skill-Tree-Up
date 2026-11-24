// =========================================================
// 📑 COPIAR BLOCO DE CÓDIGO / CITAÇÃO (editores de notas e neurônios)
// O ícone é desenhado só por CSS (::after no canto direito do bloco),
// então nada entra no texto salvo. Aqui só vemos se o clique caiu em
// cima dele e copiamos o texto do bloco.
// =========================================================
const BLOCK_SEL = '.editor pre, .editor blockquote';
const HIT = 24; // px do canto superior direito que contam como o ícone

const flash = (x, y, ok) => {
  const tip = document.createElement('div');
  tip.className = 'block-copy-tip';
  tip.textContent = ok ? 'Copiado!' : 'Não deu para copiar';
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
  document.body.appendChild(tip);
  setTimeout(() => tip.remove(), 1100);
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // reserva: textarea escondida + execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
};

export function installBlockCopy() {
  if (typeof document === 'undefined') return;
  const hitBlock = (e) => {
    const t = e.target;
    const el = t && t.nodeType === 1 ? t.closest(BLOCK_SEL) : null;
    if (!el) return null;
    // bloco dentro de bloco (citação com código): vale o mais de dentro
    const r = el.getBoundingClientRect();
    if (e.clientX < r.right - HIT || e.clientX > r.right || e.clientY < r.top || e.clientY > r.top + HIT) return null;
    return el;
  };
  // mousedown: impede o cursor de ir para o bloco ao clicar no ícone
  document.addEventListener(
    'mousedown',
    (e) => {
      if (e.button !== 0) return;
      const el = hitBlock(e);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const text = (el.innerText || el.textContent || '').replace(/\n+$/, '');
      copyText(text).then((ok) => flash(e.clientX, e.clientY, ok));
    },
    true
  );
}
