/* =========================================================
   TEXTO / HTML DAS NOTAS
   Notas antigas podem ser texto puro ou HTML (editor rico).
========================================================= */

const HTML_RE = /<\/?[a-z][\s\S]*?>/i;
const TAG_RE = /\[([^[\]\n<>]+?)\]/g;

export function looksLikeHtml(text) {
  return HTML_RE.test(text || "");
}

export function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Texto puro (sem tags), para buscas, prévias e contagem. */
export function stripHtml(text) {
  if (!text) return "";
  if (!looksLikeHtml(text)) return text;
  return decodeEntities(
    text
      .replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  ).replace(/\n{3,}/g, "\n\n").trim();
}

const BLOCKED_TAGS = ["script", "style", "iframe", "object", "embed", "link", "meta", "base", "form", "input", "button", "textarea", "select"];

/** Remove scripts, handlers on* e URLs javascript: de HTML vindo de notas/importação. */
export function sanitizeHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";
  root.querySelectorAll(BLOCKED_TAGS.join(",")).forEach((el) => el.remove());
  root.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if ((name === "href" || name === "src" || name === "xlink:href") && value.startsWith("javascript:")) {
        el.removeAttribute(attr.name);
      } else if (name === "contenteditable") el.removeAttribute(attr.name);
    }
  });
  return root.innerHTML;
}

/** Texto digitado em <textarea> -> HTML (evita que "<b>" digitado vire tag). */
export function plainToHtml(text) {
  return escapeHtml(text || "").replace(/\r?\n/g, "<br>");
}

/**
 * Se a nota for "texto simples" (sem formatação além de quebras de linha),
 * devolve o texto para editar num <textarea>. Se tiver formatação, devolve null.
 */
export function htmlToPlainIfSimple(text) {
  if (!text) return "";
  if (!looksLikeHtml(text)) return text;
  const withoutBr = text.replace(/<br\s*\/?>/gi, "\n");
  if (looksLikeHtml(withoutBr)) return null;
  return decodeEntities(withoutBr);
}

/** Converte o conteúdo salvo de uma nota em HTML seguro. */
export function noteToHtml(text) {
  if (!text) return "";
  if (looksLikeHtml(text)) return sanitizeHtml(text);
  return escapeHtml(text).replace(/\n/g, "<br>");
}

/** Envolve [tags] (apenas em nós de texto) com <span class="tag-link">. */
export function linkifyTags(html) {
  if (!html || !html.includes("[")) return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const node of textNodes) {
    const value = node.nodeValue;
    TAG_RE.lastIndex = 0;
    if (!TAG_RE.test(value)) continue;
    TAG_RE.lastIndex = 0;
    const frag = doc.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = TAG_RE.exec(value))) {
      const word = m[1].trim();
      if (!word) continue;
      if (m.index > last) frag.appendChild(doc.createTextNode(value.slice(last, m.index)));
      const span = doc.createElement("span");
      span.className = "tag-link";
      span.setAttribute("data-tag", word.toLowerCase());
      span.setAttribute("tabindex", "0");
      const open = doc.createElement("span");
      open.className = "tag-bracket";
      open.textContent = "[";
      const close = doc.createElement("span");
      close.className = "tag-bracket";
      close.textContent = "]";
      span.append(open, doc.createTextNode(word), close);
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (last < value.length) frag.appendChild(doc.createTextNode(value.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  return root.innerHTML;
}

/** Tags [palavra] (minúsculas) de um texto/HTML. */
export function extractTags(text) {
  const plain = stripHtml(text);
  const out = new Set();
  for (const m of plain.matchAll(TAG_RE)) {
    const tag = m[1].trim().toLowerCase();
    if (tag) out.add(tag);
  }
  return out;
}

export function recordHasTag(record, tag) {
  return extractTags(`${record.title || ""} ${record.text || ""}`).has(tag);
}

export function recordLabel(record, max = 30) {
  if (record.title) return record.title;
  const plain = stripHtml(record.text || "").replace(/\s+/g, " ").trim();
  if (!plain) return "Sem título";
  return plain.length > max ? plain.slice(0, max) + "…" : plain;
}

/** Reduz imagens grandes antes de salvar (economiza espaço do navegador). */
export function downscaleImage(dataUrl, maxSide = 1600, quality = 0.88) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      const isPng = dataUrl.startsWith("data:image/png") || dataUrl.startsWith("data:image/gif");
      if (scale === 1 && dataUrl.length < 600_000) return resolve(dataUrl);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality);
      resolve(out.length < dataUrl.length ? out : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
