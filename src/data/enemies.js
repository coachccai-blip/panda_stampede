// Bestiaire (§8 du brief). Chaque espèce apprivoisée apporte un bonus d'armée
// distinct : c'est ce qui rend la diversité (et donc l'apprivoisement) payante.

export const SPECIES = {
  panda: {
    key: 'panda',
    name: 'Panda',
    icon: '🐼',
    style: 'bamboo',
    color: 0xf5f5f4,
    accent: 0x1f2937,
    bonus: null,
    codex: false,
    lore: 'Le moine-guerrier. Fiable, patient, et toujours affamé.',
  },
  boar: {
    key: 'boar',
    name: 'Sanglier',
    icon: '🐗',
    style: 'fire',
    color: 0x92400e,
    accent: 0xfbbf24,
    behaviour: 'charge',
    bonus: { stat: 'power', per: 0.030, cap: 0.45 },
    bonusLabel: '+ Puissance de combat',
    codex: true,
    lore: 'Charge en ligne droite sans jamais douter. L\'Eau le calme.',
  },
  wolf: {
    key: 'wolf',
    name: 'Loup',
    icon: '🐺',
    style: 'wind',
    color: 0x64748b,
    accent: 0xe2e8f0,
    behaviour: 'pack',
    bonus: { stat: 'handling', per: 0.035, cap: 0.50 },
    bonusLabel: '+ Maniabilité',
    codex: true,
    lore: 'Arrive en meute dispersée. Difficile à affronter de face.',
  },
  elephant: {
    key: 'elephant',
    name: 'Éléphant',
    icon: '🐘',
    style: 'bamboo',
    color: 0x7c8ba1,
    accent: 0xcbd5e1,
    behaviour: 'block',
    bonus: { stat: 'resist', per: 0.028, cap: 0.40 },
    bonusLabel: '+ Résistance aux pertes',
    codex: true,
    lore: 'Lent, immense, il bloque la voie. Le Vent le contourne.',
  },
  eagle: {
    key: 'eagle',
    name: 'Aigle',
    icon: '🦅',
    style: 'water',
    color: 0x0ea5e9,
    accent: 0xfef08a,
    behaviour: 'dive',
    bonus: { stat: 'harvest', per: 0.035, cap: 0.55 },
    bonusLabel: '+ Bambou récolté',
    codex: true,
    lore: 'Fond depuis le ciel par vagues. Oblige à des esquives vives.',
  },
  snake: {
    key: 'snake',
    name: 'Serpent',
    icon: '🐍',
    style: 'fire',
    color: 0x16a34a,
    accent: 0xfacc15,
    behaviour: 'ambush',
    bonus: { stat: 'tame', per: 0.022, cap: 0.30 },
    bonusLabel: '+ Taux d\'apprivoisement',
    codex: true,
    lore: 'Surgit tard sur la piste. Peu de temps pour décider.',
  },
  crane: {
    key: 'crane',
    name: 'Grue',
    icon: '🕊️',
    style: 'wind',
    color: 0xf8fafc,
    accent: 0xf472b6,
    behaviour: 'dive',
    bonus: { stat: 'handling', per: 0.030, cap: 0.35 },
    bonusLabel: '+ Maniabilité',
    codex: true,
    lore: 'Gardienne du Temple Céleste. Ne combat que par nécessité.',
  },
};

export const TAMEABLE = ['boar', 'wolf', 'elephant', 'eagle', 'snake', 'crane'];

/** Plafonds cumulés des bonus d'armée, pour éviter les runs dégénérées. */
export const BONUS_CAPS = {
  power: 0.60,
  handling: 0.60,
  resist: 0.50,
  harvest: 0.70,
  tame: 0.35,
};

export function speciesOf(key) {
  return SPECIES[key] || SPECIES.panda;
}
