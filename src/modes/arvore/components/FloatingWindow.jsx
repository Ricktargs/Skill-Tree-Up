import { useEffect, useRef, useState } from "react";
import { sfx } from "../lib/sound";

const HEADER_KEEP_VISIBLE = 80;

function clampPos(pos, width) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    left: Math.min(Math.max(pos.left, -(width - HEADER_KEEP_VISIBLE)), vw - HEADER_KEEP_VISIBLE),
    top: Math.min(Math.max(pos.top, 0), vh - 40),
  };
}

/**
 * Janela flutuante arrastável e redimensionável.
 * Usada pelos painéis de galho, notas e busca.
 */
export default function FloatingWindow({
  initialPos,
  width,
  height,
  minWidth = 320,
  minHeight = 260,
  zIndex,
  onFocus,
  onClose,
  onCloseAll,
  title,
  icon,
  className = "",
  children,
  ...rest
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState(() => clampPos(initialPos, width));
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p, ref.current?.offsetWidth || width));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [width]);

  const handlePointerDown = (e) => {
    if (e.button !== 0 || e.target.closest("button, input, select, textarea, [contenteditable='true']")) return;
    e.preventDefault();
    const rect = ref.current.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const { dx, dy, w } = dragRef.current;
    setPos(clampPos({ left: e.clientX - dx, top: e.clientY - dy }, w));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const handleClose = (e) => {
    sfx.play("close");
    if ((e.ctrlKey || e.metaKey) && onCloseAll) onCloseAll();
    else onClose?.();
  };

  return (
    <aside
      ref={ref}
      className={`floating-window ${dragging ? "is-dragging" : ""} ${className}`}
      style={{
        left: pos.left,
        top: pos.top,
        width,
        height,
        minWidth,
        minHeight,
        zIndex,
      }}
      onPointerDownCapture={onFocus}
      {...rest}
    >
      <div
        className="window-header"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="window-grip" aria-hidden="true" />
        {icon && <span className="window-icon" aria-hidden="true">{icon}</span>}
        <span className="window-title">{title}</span>
        <button
          type="button"
          className="icon-button window-close"
          onClick={handleClose}
          title="Fechar (Ctrl+Clique fecha todas as janelas)"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
      {children}
    </aside>
  );
}
