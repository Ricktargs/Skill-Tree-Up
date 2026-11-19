// =========================================================
// PRIMEIRA VEZ NO ORBE-G
// Importado antes de tudo no main.jsx: se o navegador/app ainda não
// tem NADA salvo, é um usuário novo (vê as boas-vindas com o tutorial).
// Quem já usava o programa não vê a janela de boas-vindas.
// =========================================================
const KEY = 'orbe-welcome-v1';

const detect = () => {
  try {
    if (localStorage.getItem(KEY)) return false;
    if (localStorage.length > 0) {
      // já usava antes desta versão
      localStorage.setItem(KEY, 'antigo');
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

let isNew = detect();

export const isNewUser = () => isNew;
export const markWelcomeDone = () => {
  isNew = false;
  try {
    localStorage.setItem(KEY, 'feito');
  } catch {
    /* só não lembra */
  }
};
