// =========================================================
// 🎈 BALÃO NAS NOTAS
// Selecione um trecho → aparece "🎈 Balão". Aceitando, o trecho vira um
// balão: um 🎈 pequeno (da cor escolhida) flutua no fim dele e, passando o
// mouse em cima, abre uma janelinha com uma mensagem extra (até 50 mil
// caracteres), com ✕ para fechar e 🗑 para remover o balão.
// A mensagem fica guardada no próprio texto (data-msg), então desfazer,
// páginas (+Pag), backup e cópia funcionam sem nada a mais.
// =========================================================
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './BalloonLayer.css';

export const BALLOON_COLORS = [
  { id: 'red', name: 'Vermelho' },
  { id: 'orange', name: 'Laranja' },
  { id: 'yellow', name: 'Amarelo' },
  { id: 'green', name: 'Verde' },
  { id: 'blue', name: 'Azul' },
  { id: 'purple', name: 'Roxo' },
  { id: 'pink', name: 'Rosa' }
];
const MAX = 50000;
const newId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function BalloonLayer({ editorRef, onChange }) {
  const [offer, setOffer] = useState(null); // { x, y } botão "🎈 Balão"
  const [open, setOpen] = useState(null); // { id, x, y, up, pinned }
  const [text, setText] = useState('');
  const [color, setColor] = useState('red');
  const rangeRef = useRef(null);
  const popRef = useRef(null);
  const hideTimer = useRef(0);
  const nextColor = useRef(0);

  const spanOf = useCallback(
    (id) => (editorRef.current ? editorRef.current.querySelector(`span.nr-balloon[data-bid="${id}"]`) : null),
    [editorRef]
  );

  // ---------- oferecer "🎈 Balão" quando há seleção no editor ----------
  useEffect(() => {
    const onSel = () => {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || !sel.rangeCount || sel.isCollapsed) {
        setOffer(null);
        return;
      }
      const r = sel.getRangeAt(0);
      if (!el.contains(r.commonAncestorContainer) || !String(sel).trim()) {
        setOffer(null);
        return;
      }
      // dentro de um balão já existente não oferece outro
      const anc = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
      if (anc && anc.closest('.nr-balloon')) {
        setOffer(null);
        return;
      }
      rangeRef.current = r.cloneRange();
      const rects = r.getClientRects();
      const last = rects[rects.length - 1] || r.getBoundingClientRect();
      setOffer({ x: last.right, y: last.top });
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [editorRef]);

  const place = (span, pinned) => {
    const rects = span.getClientRects();
    const last = rects[rects.length - 1] || span.getBoundingClientRect();
    const up = window.innerHeight - last.bottom < 260;
    return { id: span.getAttribute('data-bid'), x: Math.max(8, Math.min(last.right - 20, window.innerWidth - 340)), y: up ? last.top - 6 : last.bottom + 6, up, pinned };
  };

  const show = (span, pinned = false) => {
    clearTimeout(hideTimer.current);
    setText(span.getAttribute('data-msg') || '');
    setColor(span.getAttribute('data-bc') || 'red');
    setOpen(place(span, pinned));
  };

  // ---------- transformar a seleção em balão ----------
  const makeBalloon = () => {
    const el = editorRef.current;
    const r = rangeRef.current;
    if (!el || !r || !el.contains(r.commonAncestorContainer)) return;
    const span = document.createElement('span');
    span.className = 'nr-balloon';
    const id = newId();
    const c = BALLOON_COLORS[nextColor.current++ % BALLOON_COLORS.length].id;
    span.setAttribute('data-bid', id);
    span.setAttribute('data-bc', c);
    span.setAttribute('data-msg', '');
    span.appendChild(r.extractContents());
    r.insertNode(span);
    // balões de dentro do trecho viram texto normal (sem balão dentro de balão)
    span.querySelectorAll('span.nr-balloon').forEach((b) => b.replaceWith(...b.childNodes));
    window.getSelection()?.removeAllRanges();
    setOffer(null);
    onChange();
    show(span, true);
  };

  // ---------- o balão não "cresce" ----------
  // Cursor no FIM de um balão: o que for digitado (ou o Enter) vai para
  // fora dele. Sem isso o navegador estende o balão e, no Enter, leva uma
  // cópia dele para a linha de baixo.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return undefined;
    const balloonEndingAt = (sel) => {
      if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
      const r = sel.getRangeAt(0);
      const node = r.startContainer;
      const host = (node.nodeType === 1 ? node : node.parentElement)?.closest('span.nr-balloon');
      if (!host || !el.contains(host)) return null;
      // há texto do balão depois do cursor? então está no meio (pode editar)
      const after = document.createRange();
      after.setStart(r.startContainer, r.startOffset);
      after.setEnd(host, host.childNodes.length);
      return after.toString().length === 0 ? host : null;
    };
    const escape = (host) => {
      // texto invisível logo depois do balão, com o cursor dentro dele
      let next = host.nextSibling;
      if (!(next && next.nodeType === 3)) {
        next = document.createTextNode('\u200B');
        host.after(next);
      } else if (!next.data.startsWith('\u200B')) {
        next.insertData(0, '\u200B');
      }
      const r = document.createRange();
      r.setStart(next, 1);
      r.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    };
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const typing = e.key === 'Enter' || (e.key && e.key.length === 1);
      if (!typing) return;
      const host = balloonEndingAt(window.getSelection());
      if (host) escape(host);
    };
    // IME / teclado do celular (não manda keydown com a letra)
    const onBefore = (e) => {
      if (!/^insert/.test(e.inputType || '')) return;
      const host = balloonEndingAt(window.getSelection());
      if (host) escape(host);
    };
    // segurança: se mesmo assim um balão foi copiado para outra linha, a cópia vira texto normal
    const onInput = () => {
      const seen = new Set();
      el.querySelectorAll('span.nr-balloon').forEach((s) => {
        const id = s.getAttribute('data-bid');
        if (seen.has(id) || !s.textContent.replace(/\u200B/g, '').length) s.replaceWith(...s.childNodes);
        else seen.add(id);
      });
    };
    el.addEventListener('keydown', onKey, true);
    el.addEventListener('beforeinput', onBefore, true);
    el.addEventListener('input', onInput);
    return () => {
      el.removeEventListener('keydown', onKey, true);
      el.removeEventListener('beforeinput', onBefore, true);
      el.removeEventListener('input', onInput);
    };
  }, [editorRef]);

  // ---------- mouse em cima de um balão ----------
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return undefined;
    const over = (e) => {
      const span = e.target.closest && e.target.closest('span.nr-balloon');
      if (!span || !el.contains(span)) return;
      if (open && open.pinned && open.id !== span.getAttribute('data-bid')) return;
      if (!open || open.id !== span.getAttribute('data-bid')) show(span);
      else clearTimeout(hideTimer.current);
    };
    const out = (e) => {
      const span = e.target.closest && e.target.closest('span.nr-balloon');
      if (!span) return;
      if (open && !open.pinned) hideTimer.current = setTimeout(() => setOpen(null), 350);
    };
    el.addEventListener('mouseover', over);
    el.addEventListener('mouseout', out);
    return () => {
      el.removeEventListener('mouseover', over);
      el.removeEventListener('mouseout', out);
    };
  });

  // a janela acompanha a rolagem; Esc fecha
  useLayoutEffect(() => {
    if (!open) return undefined;
    const re = () => {
      const s = spanOf(open.id);
      if (!s) setOpen(null);
      else setOpen((o) => (o ? { ...place(s, o.pinned) } : o));
    };
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        setOpen(null);
      }
    };
    // clicou fora da janelinha (e fora do próprio balão): fecha
    const outside = (e) => {
      const t = e.target;
      if (popRef.current && popRef.current.contains(t)) return;
      const span = t && t.closest ? t.closest('span.nr-balloon') : null;
      if (span && span.getAttribute('data-bid') === open.id) return;
      setOpen(null);
    };
    window.addEventListener('resize', re);
    window.addEventListener('scroll', re, true);
    window.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', outside, true);
    return () => {
      window.removeEventListener('resize', re);
      window.removeEventListener('scroll', re, true);
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', outside, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open && open.id]);

  const write = (val) => {
    const v = val.slice(0, MAX);
    setText(v);
    const s = open && spanOf(open.id);
    if (s) {
      s.setAttribute('data-msg', v);
      onChange();
    }
  };
  const pickColor = (c) => {
    setColor(c);
    const s = open && spanOf(open.id);
    if (s) {
      s.setAttribute('data-bc', c);
      onChange();
    }
  };
  const remove = () => {
    const s = open && spanOf(open.id);
    if (s) {
      s.replaceWith(...s.childNodes);
      onChange();
    }
    setOpen(null);
  };

  return (
    <>
      {offer &&
        !open &&
        createPortal(
          <button
            type="button"
            className="nr-balloon-offer"
            style={{ left: Math.max(8, Math.min(offer.x - 30, window.innerWidth - 110)), top: Math.max(8, offer.y - 36) }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={makeBalloon}
            title="Transformar o trecho selecionado num balão com uma mensagem"
          >
            🎈 Balão
          </button>,
          document.body
        )}
      {open &&
        createPortal(
          <div
            ref={popRef}
            className={`nr-balloon-pop c-${color}`}
            style={{ left: open.x, top: open.y, transform: open.up ? 'translateY(-100%)' : undefined }}
            onMouseEnter={() => clearTimeout(hideTimer.current)}
            onMouseLeave={() => {
              if (!open.pinned) hideTimer.current = setTimeout(() => setOpen(null), 350);
            }}
            onMouseDown={() => {
              // mexeu na janelinha: ela fica aberta até fechar no ✕
              if (!open.pinned) setOpen((o) => (o ? { ...o, pinned: true } : o));
            }}
          >
            <div className="nr-balloon-head">
              <span className="nr-balloon-dots">
                {BALLOON_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`nr-balloon-dot c-${c.id} ${color === c.id ? 'on' : ''}`}
                    title={c.name}
                    onClick={() => pickColor(c.id)}
                  />
                ))}
              </span>
              <button type="button" className="nr-balloon-icon" title="Remover o balão (o texto continua)" onClick={remove}>
                🗑
              </button>
              <button type="button" className="nr-balloon-icon" title="Fechar" onClick={() => setOpen(null)}>
                ✕
              </button>
            </div>
            <textarea
              className="nr-balloon-text"
              placeholder="Escreva a mensagem deste balão…"
              maxLength={MAX}
              autoFocus={open.pinned}
              value={text}
              onChange={(e) => write(e.target.value)}
            />
            <div className="nr-balloon-count">
              {text.length.toLocaleString('pt-BR')} / {MAX.toLocaleString('pt-BR')}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
