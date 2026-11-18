/* =========================================================
   CONSTANTES GLOBAIS DO APP
========================================================= */

export const ROOT_ID = "eu";

export const INITIAL_TREE = {
  id: ROOT_ID,
  name: "EU",
  children: [
    { id: "estudos", name: "ESTUDOS", children: [] },
    { id: "corpo-mente", name: "CORPO & MENTE", children: [] },
    { id: "carreira", name: "CARREIRA", children: [] },
    {
      id: "relacionamentos",
      name: "RELACIONAMENTOS",
      children: [
        { id: "familia", name: "FAMÍLIA", children: [] },
        { id: "amigos", name: "AMIGOS", children: [] },
      ],
    },
    { id: "hobbies", name: "HOBBIES", children: [] },
    { id: "financeiro", name: "FINANCEIRO", children: [] },
    { id: "projetos", name: "PROJETOS", children: [] },
  ],
};

export const PASTEL_COLORS = [
  "#F6E7A1", "#A9D8E8", "#7D9BB8", "#E8A0A0", "#B8DDB5",
  "#7FA889", "#F2B880", "#E8C5A0", "#F5F2E8", "#B9A3D1",
];

export const NOTE_TYPES = ["Ideia", "Conquista", "Aprendizado", "Mudança", "Observação", "Perda"];

const NOTE_TYPE_POINTS = {
  ideia: 5,
  conquista: 50,
  aprendizado: 20,
  "mudança": 15,
  mudanca: 15,
  "observação": 2,
  observacao: 2,
  perda: 10,
};

export function pointsForType(type) {
  return NOTE_TYPE_POINTS[String(type || "Ideia").toLowerCase()] || 0;
}

/** "Observação" -> "observacao" (usado nas cores pastel de cada tipo). */
export function typeKey(type) {
  return String(type || "Ideia")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export const BRANCH_POINTS = { main: 25, sub: 10, growth: 5 };

export const FEELINGS = [
  { emoji: "😊", label: "Feliz" },
  { emoji: "🎯", label: "Focado" },
  { emoji: "🚀", label: "Motivado" },
  { emoji: "💡", label: "Inspirado" },
  { emoji: "🔥", label: "Empolgado" },
  { emoji: "📚", label: "Evoluindo" },
  { emoji: "🌱", label: "Grato" },
  { emoji: "🧘", label: "Calmo" },
  { emoji: "😴", label: "Cansado" },
  { emoji: "🤯", label: "Sobrecarregado" },
  { emoji: "😰", label: "Ansioso" },
  { emoji: "😔", label: "Triste" },
  { emoji: "😤", label: "Frustrado" },
  { emoji: "⚡", label: "Energizado" },
  { emoji: "❤️", label: "Amado" },
  { emoji: "🔍", label: "Curioso" },
  { emoji: "🏆", label: "Orgulhoso" },
  { emoji: "🛡️", label: "Seguro" },
  { emoji: "🤔", label: "Reflexivo" },
  { emoji: "✨", label: "Esperançoso" },
];

/* As chaves são as mesmas da versão anterior: os dados salvos continuam funcionando. */
export const STORAGE_KEYS = {
  tree: "eu-sou-arvore-tree",
  records: "eu-sou-arvore-records",
  offsets: "eu-sou-arvore-offsets",
  folders: "eu-sou-arvore-folders-all-v1",
  theme: "eu-sou-arvore-theme",
  revisions: "eu-sou-arvore-revisions-v1",
  pointsLog: "eu-sou-arvore-historico-pontos",
  showPoints: "eu-sou-arvore-show-points",
};

export const REVISION_DAYS = 60;
export const MAX_UNDO = 60;
