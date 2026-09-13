// Point d'entrée. Phaser est chargé en global (UMD) par index.html.

import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { RunScene } from './scenes/RunScene.js';
import { DojoScene } from './scenes/DojoScene.js';
import { ResultScene } from './scenes/ResultScene.js';

// Résolution de conception : 720 de large, portrait. La hauteur suit le ratio
// réel de l'écran au démarrage, bornée entre 16:10 et 20:9 : sur un téléphone
// moderne (19.5:9, 20:9) le jeu remplit ainsi tout l'écran au lieu de laisser
// jusqu'à 14 % de bandes noires. Toutes les mises en page sont exprimées en
// fractions de la hauteur, elles s'étirent donc proprement.
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = computeGameHeight();

function computeGameHeight() {
  const el = document.getElementById('stage') || document.body;
  const w = el.clientWidth || window.innerWidth || 720;
  const h = el.clientHeight || window.innerHeight || 1280;
  if (!w || !h) return 1280;
  const ideal = Math.round(GAME_WIDTH * (h / w));
  return Math.max(1150, Math.min(1600, ideal));
}

const config = {
  type: Phaser.AUTO,
  parent: 'stage',
  backgroundColor: '#0b1410',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, MenuScene, RunScene, DojoScene, ResultScene],
};

const game = new Phaser.Game(config);

// Utile pour le playtest depuis la console du navigateur.
window.PandaStampede = { game };

export default game;
