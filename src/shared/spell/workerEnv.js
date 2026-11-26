// O Hunspell (Emscripten) descobre que está num "worker" pela função
// importScripts — que não existe em worker de módulo. Sem isso ele acha que
// está num ambiente desconhecido e não inicia. (Importado antes do motor.)
if (typeof self !== 'undefined' && typeof self.importScripts !== 'function') {
  self.importScripts = () => {};
}
