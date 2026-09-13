// Les 4 styles de Kung-Fu (§4.B du brief).
// Cycle : Bambou > Feu > Vent > Eau > Bambou

export const STYLES = {
  bamboo: {
    key: 'bamboo',
    name: 'Bambou',
    short: 'BAMBOU',
    icon: '🎋',
    color: 0x4ade80,
    colorDark: 0x166534,
    css: '#4ade80',
    strongVs: 'fire',
    weakVs: 'wind',
    ability: {
      name: 'Écorce de Fer',
      desc: 'Bouclier : aucune perte d\'unité pendant 4 s.',
      duration: 4000,
      cooldown: 11000,
    },
  },
  fire: {
    key: 'fire',
    name: 'Feu',
    short: 'FEU',
    icon: '🔥',
    color: 0xf97316,
    colorDark: 0x7c2d12,
    css: '#f97316',
    strongVs: 'wind',
    weakVs: 'water',
    ability: {
      name: 'Charge Ardente',
      desc: 'Puissance de combat x2 pendant 4 s.',
      duration: 4000,
      cooldown: 12000,
    },
  },
  water: {
    key: 'water',
    name: 'Eau',
    short: 'EAU',
    icon: '💧',
    color: 0x38bdf8,
    colorDark: 0x075985,
    css: '#38bdf8',
    strongVs: 'bamboo',
    weakVs: 'fire',
    ability: {
      name: 'Courant Fluide',
      desc: 'Maniabilité parfaite + esquive totale pendant 3,5 s.',
      duration: 3500,
      cooldown: 11000,
    },
  },
  wind: {
    key: 'wind',
    name: 'Vent',
    short: 'VENT',
    icon: '🌪️',
    color: 0xcbd5e1,
    colorDark: 0x475569,
    css: '#cbd5e1',
    strongVs: 'water',
    weakVs: 'bamboo',
    ability: {
      name: 'Souffle Céleste',
      desc: 'Sprint : vitesse x1,6 et bambou doublé pendant 4 s.',
      duration: 4000,
      cooldown: 10000,
    },
  },
};

export const STYLE_KEYS = ['bamboo', 'fire', 'water', 'wind'];

/**
 * Relation entre le style actif et celui de la cible.
 * @returns {1|0|-1} 1 = avantage, 0 = neutre, -1 = désavantage
 */
export function matchup(attacker, defender) {
  if (!attacker || !defender) return 0;
  const a = STYLES[attacker];
  if (!a) return 0;
  if (a.strongVs === defender) return 1;
  if (a.weakVs === defender) return -1;
  return 0;
}

/** Multiplicateur de puissance de combat lié au matchup. */
export function combatMultiplier(attacker, defender) {
  const m = matchup(attacker, defender);
  if (m === 1) return 1.6;
  if (m === -1) return 0.65;
  return 1;
}

export function styleOf(key) {
  return STYLES[key] || STYLES.bamboo;
}
