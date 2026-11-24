// =========================================================
// SELETOR DE EMOJIS (balão) EM PORTUGUÊS
// Mesmo seletor de antes, mas com nomes, busca e categorias em português.
// Os emojis aqui continuam coloridos (é a escolha do emoji).
// =========================================================
import React from 'react';
import EmojiPicker, { Categories } from 'emoji-picker-react';
import ptData from 'emoji-picker-react/dist/data/emojis-pt.json';
import { getLanguage } from '../i18n/index.jsx';

const PT_CATEGORIES = [
  { category: Categories.SUGGESTED, name: 'Usados recentemente' },
  { category: Categories.SMILEYS_PEOPLE, name: 'Carinhas e pessoas' },
  { category: Categories.ANIMALS_NATURE, name: 'Animais e natureza' },
  { category: Categories.FOOD_DRINK, name: 'Comidas e bebidas' },
  { category: Categories.TRAVEL_PLACES, name: 'Viagens e lugares' },
  { category: Categories.ACTIVITIES, name: 'Atividades' },
  { category: Categories.OBJECTS, name: 'Objetos' },
  { category: Categories.SYMBOLS, name: 'Símbolos' },
  { category: Categories.FLAGS, name: 'Bandeiras' }
];

export default function EmojiPickerPT(props) {
  const pt = getLanguage() === 'pt';
  if (!pt) return <EmojiPicker {...props} />;
  return (
    <EmojiPicker
      emojiData={ptData}
      categories={PT_CATEGORIES}
      searchClearButtonLabel="Limpar"
      previewConfig={{ defaultCaption: 'Escolha um emoji' }}
      {...props}
      searchPlaceholder="Buscar emoji…"
      searchPlaceHolder="Buscar emoji…"
    />
  );
}
