import { useRef } from "react";
import { createPortal } from "react-dom";
import { portalRoot } from "../lib/portal";

/**
 * Modal centralizado. Só fecha ao clicar no fundo se o clique
 * COMEÇOU no fundo (evita fechar ao arrastar algo para fora).
 */
export default function Modal({ title, icon, onClose, width = 440, className = "", zIndex, children }) {
  const downOnOverlay = useRef(false);
  return createPortal(
    <div
      className="modal-overlay"
      style={zIndex ? { zIndex } : undefined}
      onPointerDown={(e) => {
        downOnOverlay.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnOverlay.current && e.target === e.currentTarget) onClose();
        downOnOverlay.current = false;
      }}
    >
      <div className={`modal-content ${className}`} style={{ maxWidth: width }} role="dialog" aria-modal="true">
        {title && (
          <div className="modal-header">
            <h3>
              {icon && <span className="modal-icon" aria-hidden="true">{icon}</span>}
              {title}
            </h3>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    portalRoot()
  );
}
