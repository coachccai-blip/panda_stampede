// Progression méta du Dojo (§11). Coûts et effets pilotés par données.

export const UPGRADES = [
  {
    key: 'handling',
    name: 'Pas du Roseau',
    icon: '🌀',
    desc: 'Réduit le malus Yin-Yang : ton armée vire plus vite malgré sa masse.',
    max: 6,
    cost: (lvl) => 60 + lvl * 55,
    effect: (lvl) => 0.09 * lvl,       // +9 % de maniabilité par niveau
    format: (lvl) => `+${Math.round(9 * lvl)} % maniabilité`,
  },
  {
    key: 'tame',
    name: 'Voie de la Paume Ouverte',
    icon: '🤝',
    desc: 'Augmente le taux de réussite de l\'apprivoisement.',
    max: 6,
    cost: (lvl) => 80 + lvl * 70,
    effect: (lvl) => 0.04 * lvl,       // +4 points de % par niveau
    format: (lvl) => `+${4 * lvl} pts d'apprivoisement`,
  },
  {
    key: 'start',
    name: 'Frères de Cordée',
    icon: '🐼',
    desc: 'Pandas supplémentaires au départ de chaque run.',
    max: 8,
    cost: (lvl) => 50 + lvl * 45,
    effect: (lvl) => 2 * lvl,
    format: (lvl) => `+${2 * lvl} pandas au départ`,
  },
  {
    key: 'resist',
    name: 'Racines Profondes',
    icon: '🛡️',
    desc: 'Réduit les pertes en combat perdu et sur les bords de piste.',
    max: 5,
    cost: (lvl) => 90 + lvl * 80,
    effect: (lvl) => 0.06 * lvl,
    format: (lvl) => `-${Math.round(6 * lvl)} % de pertes`,
  },
  {
    key: 'ability',
    name: 'Souffle Intérieur',
    icon: '⚡',
    desc: 'Réduit le temps de recharge des capacités de style.',
    max: 5,
    cost: (lvl) => 100 + lvl * 85,
    effect: (lvl) => 0.08 * lvl,
    format: (lvl) => `-${Math.round(8 * lvl)} % de recharge`,
  },
  {
    key: 'harvest',
    name: 'Panier de Bambou',
    icon: '🎍',
    desc: 'Augmente le bambou récolté pendant les runs.',
    max: 6,
    cost: (lvl) => 70 + lvl * 60,
    effect: (lvl) => 0.10 * lvl,
    format: (lvl) => `+${Math.round(10 * lvl)} % de bambou`,
  },
  {
    key: 'chi',
    name: 'Éveil du Chi',
    icon: '☯',
    desc: 'Le Chi se remplit plus vite : l\'Éveil revient plus souvent.',
    max: 5,
    cost: (lvl) => 120 + lvl * 95,
    effect: (lvl) => 0.10 * lvl,     // -10 % de Chi requis par niveau
    format: (lvl) => `−${Math.round(10 * lvl)} % de Chi requis`,
  },
];

// Compagnons de départ : débloqués une fois l'espèce inscrite au codex.
export const COMPANIONS = [
  { key: 'boar', name: 'Sanglier de cordée', icon: '🐗', cost: 220, count: 3 },
  { key: 'wolf', name: 'Loup éclaireur', icon: '🐺', cost: 260, count: 3 },
  { key: 'elephant', name: 'Éléphant de garde', icon: '🐘', cost: 300, count: 2 },
  { key: 'eagle', name: 'Aigle guetteur', icon: '🦅', cost: 320, count: 2 },
  { key: 'snake', name: 'Serpent conseiller', icon: '🐍', cost: 340, count: 2 },
];

// Skins : débloqués en apprivoisant un général (§10), jamais achetables.
export const SKINS = {
  default: { name: 'Moine de Bambou', icon: '🐼', body: 0xf5f5f4, accent: 0x1f2937 },
  boar: { name: 'Robe du Sanglier', icon: '🐗', body: 0xfbbf24, accent: 0x7c2d12 },
  wolf: { name: 'Robe du Loup', icon: '🐺', body: 0xe2e8f0, accent: 0x334155 },
  eagle: { name: 'Robe de l\'Aigle', icon: '🦅', body: 0xbae6fd, accent: 0x0369a1 },
  snake: { name: 'Robe du Serpent', icon: '🐍', body: 0xbbf7d0, accent: 0x14532d },
  crane: { name: 'Robe Céleste', icon: '🕊️', body: 0xfef3c7, accent: 0x7c3aed },
};

// Bonus passifs de complétion du codex (§11).
export const CODEX_BONUSES = [
  { at: 2, stat: 'harvest', value: 0.05, label: '+5 % bambou' },
  { at: 4, stat: 'tame', value: 0.05, label: '+5 pts d\'apprivoisement' },
  { at: 6, stat: 'power', value: 0.10, label: '+10 % puissance' },
];

export function upgradeByKey(key) {
  return UPGRADES.find((u) => u.key === key);
}
