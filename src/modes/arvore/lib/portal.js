// As janelas que "saem" da árvore (modais, menus) ficam dentro do contêiner
// .arvore-root, senão perderiam os estilos isolados da Árvore.
export const portalRoot = () => document.querySelector('.arvore-root') || document.body;
