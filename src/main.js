// Point d'entrée. Phaser est chargé en global (UMD) par index.html.

import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { RunScene } from './scenes/RunScene.js';
import { DojoScene } from './scenes/DojoScene.js';
import { ResultScene } from './scenes/ResultScene.js';

// Résolution de conception : portrait mobile, mise à l'échelle automatique.
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
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
