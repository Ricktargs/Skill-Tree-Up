// =========================================================
// ÍCONES DO ORBE-G (botões principais)
// Estilo nanquim + aquarela: silhueta cheia de tinta (cor do texto)
// sobre uma mancha de aquarela na cor do tema, cada uma de um jeito.
// O de Tema é uma aquarela de verdade: três cores se misturando.
// =========================================================
import React from 'react';

// manchas de aquarela (bordas irregulares, como tinta no papel)
const WASHES = [
  'M5.4 6.2c2.6-2.9 8.4-3.6 11.6-1.2 3 2.2 3.7 6.9 2.3 10.4-1.6 3.9-6.3 5.9-10.2 4.6C5.3 18.8 2.6 15 3 11.2c.2-1.9 1.1-3.6 2.4-5z',
  'M6.8 4.6c3.2-1.7 8.7-.9 11 2.3 2.1 3 1.6 7.6-.9 10.3-2.6 2.8-7.5 3.6-10.8 1.7C2.8 17 2 12.9 3.2 9.7c.7-2.1 1.9-4 3.6-5.1z',
  'M4.6 8.4C5.9 4.9 10.6 3 14.6 3.9c3.6.8 6.1 4.4 5.7 8-.4 3.9-3.6 7.5-7.6 8-3.7.5-7.8-1.8-8.8-5.4-.5-1.9-.1-4.1.7-6.1z'
];
const Wash = ({ n = 0 }) => <path className="app-ic-wash" d={WASHES[n % WASHES.length]} />;

const ICONS = {
  profile: (
    <>
      <Wash n={0} />
      <circle className="app-ic-ink" cx="12" cy="8.4" r="3.9" />
      <path className="app-ic-ink" d="M4.6 20.4c.5-4.2 3.6-6.8 7.4-6.8s6.9 2.6 7.4 6.8c0 .4-.3.7-.7.7H5.3c-.4 0-.7-.3-.7-.7z" />
    </>
  ),
  pomodoro: (
    <>
      <Wash n={1} />
      <path className="app-ic-ink" fillRule="evenodd" d="M6.2 3h11.6a.9.9 0 0 1 0 1.8h-.9c-.1 2.6-1.5 4.5-3.6 6.2v2c2.1 1.7 3.5 3.6 3.6 6.2h.9a.9.9 0 0 1 0 1.8H6.2a.9.9 0 0 1 0-1.8h.9c.1-2.6 1.5-4.5 3.6-6.2v-2C8.6 9.3 7.2 7.4 7.1 4.8h-.9a.9.9 0 0 1 0-1.8zm2.7 1.8c.1 1.9 1.2 3.4 3.1 4.8 1.9-1.4 3-2.9 3.1-4.8H8.9z" />
      <path className="app-ic-sand" d="M9.4 19.2c.4-1.6 1.3-2.6 2.6-3.4 1.3.8 2.2 1.8 2.6 3.4z" />
    </>
  ),
  missions: (
    <>
      <Wash n={2} />
      <path className="app-ic-ink" fillRule="evenodd" d="M7.4 3.6h10a2.4 2.4 0 0 1 2.4 2.4v1.3h-2.6v10.4a2.8 2.8 0 0 1-2.8 2.8H6.6a2.4 2.4 0 0 1-2.4-2.4v-1.6h2.6V6.2a2.6 2.6 0 0 1 .6-2.6zM9.2 8.4h5.6v1.5H9.2zm0 3.2h5.6v1.5H9.2zm0 3.2h3.6v1.5H9.2z" />
    </>
  ),
  missionsDone: (
    <>
      <Wash n={2} />
      <path className="app-ic-ink" fillRule="evenodd" d="M7.4 3.6h10a2.4 2.4 0 0 1 2.4 2.4v1.3h-2.6v10.4a2.8 2.8 0 0 1-2.8 2.8H6.6a2.4 2.4 0 0 1-2.4-2.4v-1.6h2.6V6.2a2.6 2.6 0 0 1 .6-2.6zm1.9 8.3l1.1-1.1 1.6 1.6 3.4-3.5 1.1 1.1-4.5 4.6z" />
    </>
  ),
  organize: (
    <>
      <Wash n={1} />
      <rect className="app-ic-ink" x="9" y="5.2" width="11" height="2.6" rx="1.3" />
      <rect className="app-ic-ink" x="9" y="10.7" width="11" height="2.6" rx="1.3" />
      <rect className="app-ic-ink" x="9" y="16.2" width="8" height="2.6" rx="1.3" />
      <circle className="app-ic-ink" cx="5" cy="6.5" r="1.5" />
      <circle className="app-ic-ink" cx="5" cy="12" r="1.5" />
      <circle className="app-ic-ink" cx="5" cy="17.5" r="1.5" />
    </>
  ),
  moon: (
    <>
      <Wash n={0} />
      <path className="app-ic-ink" d="M14.2 3.2a8.6 8.6 0 1 0 6.6 12.6A7.2 7.2 0 0 1 14.2 3.2z" />
      <circle className="app-ic-ink" cx="18.6" cy="5.4" r="1.1" />
    </>
  ),
  sun: (
    <>
      <Wash n={2} />
      <circle className="app-ic-ink" cx="12" cy="12" r="4.4" />
      <path className="app-ic-ray" d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5" />
    </>
  ),
  settings: (
    <>
      <Wash n={1} />
      <path
        className="app-ic-ink"
        fillRule="evenodd"
        d="M10.4 2.6h3.2l.5 2.4c.6.2 1.1.5 1.6.9l2.3-.8 1.6 2.8-1.8 1.6c.1.6.1 1.2 0 1.8l1.8 1.6-1.6 2.8-2.3-.8c-.5.4-1 .7-1.6.9l-.5 2.4h-3.2l-.5-2.4c-.6-.2-1.1-.5-1.6-.9l-2.3.8-1.6-2.8 1.8-1.6a5.6 5.6 0 0 1 0-1.8L4.4 8.3 6 5.5l2.3.8c.5-.4 1-.7 1.6-.9zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
        transform="translate(0 0.4)"
      />
    </>
  ),
  // Tema: aquarela — três manchas que se misturam e um pincel
  theme: (
    <>
      <path className="app-ic-wc wc-a" d="M3.6 9.6c.4-3.2 3.6-5.6 6.8-5 2.8.5 4.4 3.3 3.6 6-.8 2.8-3.8 4.4-6.6 3.8-2.4-.5-4.1-2.5-3.8-4.8z" />
      <path className="app-ic-wc wc-b" d="M10.6 9.2c2.2-1.7 5.8-1.2 7.4 1.1 1.5 2.1.9 5.2-1.2 6.6-2.2 1.5-5.4 1-6.9-1.2-1.3-1.8-1-4.9.7-6.5z" />
      <path className="app-ic-wc wc-c" d="M4.8 15.4c.9-2.3 3.8-3.3 6-2.3 2.1.9 2.9 3.6 1.8 5.5-1.1 2-3.9 2.7-5.9 1.6-1.7-.9-2.6-3-1.9-4.8z" />
      <path className="app-ic-ink" d="M20.6 2.6c.5.5.4 1.2-.1 1.7l-5.8 6.4-1.4-1.4 6.4-5.8c.5-.5 1.2-.5 1.7-.1z" />
      <path className="app-ic-ink" d="M12.6 10.1l1.4 1.4c-.3 1.6-1.6 2.6-3.3 2.4.4-.6.5-1.1.6-1.7.1-1 .5-1.8 1.3-2.1z" />
    </>
  ),
  tasks: (
    <>
      <Wash n={0} />
      <path
        className="app-ic-ink"
        fillRule="evenodd"
        d="M9.2 3h5.6c.7 0 1.2.5 1.2 1.2V5h1.4c1.3 0 2.3 1 2.3 2.3v11.4c0 1.3-1 2.3-2.3 2.3H6.6c-1.3 0-2.3-1-2.3-2.3V7.3C4.3 6 5.3 5 6.6 5H8v-.8C8 3.5 8.5 3 9.2 3zm-1.5 8.9l1-1 1.3 1.3 2.6-2.7 1 1-3.6 3.7zm.3 4h8v1.6H8zM13.5 10.6h2.5v1.6h-2.5z"
      />
    </>
  ),
  notes: (
    <>
      <Wash n={2} />
      <path className="app-ic-ink" d="M20.8 3.2c-7.6.3-12.4 4.8-13.5 12.6l-.1.9 2.6-2.7c.4-.4 1-.4 1.4 0s.4 1 0 1.4l-2.6 2.6.9-.1c7.8-1.1 12.3-5.9 12.6-13.5 0-.7-.6-1.2-1.3-1.2z" />
      <path className="app-ic-ink" d="M7.6 17.6l-3 3a.9.9 0 0 1-1.3-1.3l3-3z" />
    </>
  ),
  flashcards: (
    <>
      <Wash n={1} />
      <path className="app-ic-ink app-ic-back" d="M6.4 6.8h1.2v11.4c0 1 .8 1.8 1.8 1.8h7.4v.4c0 1-.8 1.8-1.8 1.8H6.4c-1 0-1.8-.8-1.8-1.8V8.6c0-1 .8-1.8 1.8-1.8z" />
      <path className="app-ic-ink" fillRule="evenodd" d="M10.6 2.8h8.2c1.1 0 2 .9 2 2v11c0 1.1-.9 2-2 2h-8.2c-1.1 0-2-.9-2-2v-11c0-1.1.9-2 2-2zm1.6 4.4v1.6h5V7.2zm0 3.4v1.6h3.6v-1.6z" />
    </>
  )
};

export default function AppIcon({ name, size = 24, title }) {
  const body = ICONS[name];
  if (!body) return null;
  return (
    <svg
      className={`app-ic ic-${name}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
}
