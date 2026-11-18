// =========================================================
// CONTEÚDO INICIAL DE UM PERFIL NOVO
// 2 habilidades (com mini missões), 1 deck de flashcards com 5 cartas
// e 2 tarefas ligadas às habilidades.
// =========================================================
import { readProfileRaw, writeProfileValue } from '../atualizacao2_0/ProfileStorage.js';

const stamp = () => new Date().toISOString();
const rid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const STARTER_FOLDERS = ['Geral', 'Estudos'];

export const starterSkills = () => [
  {
    id: 'skill_java',
    title: 'Programador de Java',
    category: 'Tecnologia',
    folder: 'Estudos',
    level: 0,
    maxLevel: 10,
    color: '#f97316',
    levelDescriptions: {
      1: 'Instalar o JDK e rodar o primeiro "Olá, mundo!"',
      2: 'Variáveis, tipos e condicionais (if / switch)'
    },
    levelTasks: {
      1: [{ id: 'java_t1', text: 'Instalar o JDK e uma IDE (IntelliJ ou VS Code)', done: false }],
      2: [{ id: 'java_t2', text: 'Escrever um programa que diz se um número é par ou ímpar', done: false }]
    },
    miniMissions: ['Programar em Java por 20 minutos']
  },
  {
    id: 'skill_leitura',
    title: 'Leitor Voraz',
    category: 'Leitura',
    folder: 'Geral',
    level: 0,
    maxLevel: 10,
    color: '#a855f7',
    levelDescriptions: {
      1: 'Criar o hábito: ler um pouco todos os dias',
      2: 'Terminar o primeiro livro do ano'
    },
    levelTasks: {
      1: [{ id: 'leitura_t1', text: 'Escolher o próximo livro', done: false }],
      2: [{ id: 'leitura_t2', text: 'Anotar uma ideia marcante do livro', done: false }]
    },
    miniMissions: ['Ler 10 páginas de um livro']
  }
];

const STARTER_CARDS = [
  ['O que é a JVM?', 'A Máquina Virtual Java: executa o bytecode, por isso o mesmo programa roda em qualquer sistema.'],
  ['Qual a diferença entre JDK e JRE?', 'O JDK traz as ferramentas para programar (compilador javac); o JRE só executa programas Java.'],
  ['Qual é o método que inicia um programa Java?', 'public static void main(String[] args)'],
  ['int x String: qual é tipo primitivo?', 'int é primitivo; String é uma classe (objeto).'],
  ['Como imprimir um texto no console?', 'System.out.println("texto");']
];

export const starterFlashcards = () => {
  const deckId = rid('deck');
  const now = stamp();
  return {
    decks: [
      {
        id: deckId,
        name: 'Java: primeiros passos',
        emoji: '☕',
        skillId: 'skill_java',
        moduleId: null,
        notify: true,
        intervals: { again: 0, hard: 1, good: 1, easy: 4, grow: true },
        createdAt: now
      }
    ],
    cards: STARTER_CARDS.map(([front, back], i) => ({
      id: `${deckId}_c${i}`,
      deckId,
      front,
      back,
      createdAt: now,
      due: '',
      interval: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      lastReview: null
    })),
    stats: { streak: 0, lastStudyDay: '', daily: {} }
  };
};

export const starterTaskLists = () => [
  {
    id: 'list_default',
    title: 'Geral',
    tasks: [
      {
        id: rid('task'),
        title: 'Estudar os flashcards de Java',
        description: 'Programador de Java: abra os Flashcards (tecla F) e revise o deck "Java: primeiros passos".'
      },
      {
        id: rid('task'),
        title: 'Escolher o próximo livro para ler',
        description: 'Leitor Voraz: separe um livro e leia as primeiras 10 páginas.'
      }
    ]
  }
];

// A Árvore de um perfil novo não converte pontos antigos em XP
export const ARVORE_XP_SYNC_KEY = 'eu-sou-arvore-xp-sync';

/** Grava tarefas, flashcards e marcadores iniciais (só o que ainda não existe). */
export function seedStarterProfile(profileId) {
  if (!profileId) return;
  const seed = (base, value) => {
    if (readProfileRaw(base, profileId) === null) writeProfileValue(base, profileId, value);
  };
  seed('task_update_lists_v1', starterTaskLists());
  seed('rpg_flashcards_v1', starterFlashcards());
  seed(ARVORE_XP_SYNC_KEY, 'done');
}
