import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import './Dialog.css';
import { tx } from '../i18n/index.jsx';

// =========================================================
// JANELA PADRÃO DE PERGUNTA (substitui alert/confirm/prompt)
//   await ask({ title, message, yes, no, danger })  -> true/false
//   await inform({ title, message, ok })            -> (fecha no Ok)
//   await askText({ title, message, value })        -> texto ou null
// Enter = confirma · Esc = cancela · uma janela por vez (fila)
// =========================================================

let queue = [];
let version = 0;
const listeners = new Set();
const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};

const push = (dialog) =>
  new Promise((resolve) => {
    queue = [...queue, { ...dialog, id: `${Date.now()}_${Math.random()}`, resolve }];
    emit();
  });

const settle = (value) => {
  const [current, ...rest] = queue;
  if (!current) return;
  queue = rest;
  emit();
  current.resolve(value);
};

export const ask = (opts = {}) =>
  push({ kind: 'ask', yes: tx('Sim'), no: tx('Não'), ...(typeof opts === 'string' ? { message: opts } : opts) });

export const inform = (opts = {}) =>
  push({ kind: 'inform', ok: tx('Ok'), ...(typeof opts === 'string' ? { message: opts } : opts) });

export const askText = (opts = {}) => push({ kind: 'text', yes: tx('Ok'), no: tx('Cancelar'), value: '', ...opts });

// Várias opções: await choose({ title, message, options: [{ value, label, hint }] })
// -> value da opção escolhida, ou null se cancelar
export const choose = (opts = {}) => push({ kind: 'choose', no: tx('Cancelar'), options: [], ...opts });

export const isDialogOpen = () => queue.length > 0;

// Teclado: registrado antes de qualquer atalho do programa, para a janela
// "engolir" as teclas enquanto está aberta (nada abre por baixo dela)
let keysInstalled = false;
export function installDialogKeys() {
  if (keysInstalled || typeof window === 'undefined') return;
  keysInstalled = true;
  window.addEventListener(
    'keydown',
    (e) => {
      const current = queue[0];
      if (!current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        settle(current.kind === 'text' ? null : current.kind === 'inform' ? undefined : false);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (current.kind === 'text') {
          const input = document.querySelector('.ui-dialog-input');
          settle(input ? input.value : '');
        } else settle(current.kind === 'inform' ? undefined : true);
        return;
      }
      // Outras teclas só valem dentro do campo de texto da janela
      if (!(e.target && e.target.classList && e.target.classList.contains('ui-dialog-input'))) {
        e.stopImmediatePropagation();
      }
    },
    { capture: true }
  );
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function DialogHost() {
  useSyncExternalStore(subscribe, () => version);
  const current = queue[0];
  const inputRef = useRef(null);
  const yesRef = useRef(null);

  useEffect(() => {
    if (!current) return;
    if (current.kind === 'text') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else yesRef.current?.focus();
  }, [current]);

  if (!current) return null;

  const cancel = () => settle(current.kind === 'text' || current.kind === 'choose' ? null : current.kind === 'inform' ? undefined : false);
  const confirm = () => settle(current.kind === 'text' ? inputRef.current?.value ?? '' : current.kind === 'inform' ? undefined : true);

  return createPortal(
    <div
      className="ui-dialog-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div
        className={`ui-dialog ${current.danger ? 'is-danger' : ''}`}
        role={current.kind === 'inform' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="ui-dialog-title"
      >
        {current.icon && (
          <div className="ui-dialog-icon" aria-hidden="true">
            {current.icon}
          </div>
        )}
        <h3 id="ui-dialog-title">{current.title || (current.kind === 'inform' ? tx('Aviso') : tx('Confirmar'))}</h3>
        {current.message && <p className="ui-dialog-message">{current.message}</p>}
        {current.kind === 'text' && (
          <input
            ref={inputRef}
            className="ui-dialog-input"
            defaultValue={current.value}
            placeholder={current.placeholder || ''}
          />
        )}
        {current.kind === 'choose' && (
          <div className="ui-dialog-choices">
            {current.options.map((o, i) => (
              <button
                key={o.value}
                ref={i === 0 ? yesRef : undefined}
                type="button"
                className="ui-dialog-choice"
                onClick={() => settle(o.value)}
              >
                <b>{o.label}</b>
                {o.hint && <small>{o.hint}</small>}
              </button>
            ))}
          </div>
        )}
        <div className="ui-dialog-actions">
          {current.kind !== 'inform' && (
            <button type="button" className="ui-dialog-btn" onClick={cancel}>
              {current.no}
            </button>
          )}
          {current.kind !== 'choose' && (
            <button ref={yesRef} type="button" className={`ui-dialog-btn primary ${current.danger ? 'danger' : ''}`} onClick={confirm}>
              {current.kind === 'inform' ? current.ok : current.yes}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
