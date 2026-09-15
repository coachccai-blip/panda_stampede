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
    // Phaser réserve le pointeur 0 à la souris : avec 2, un seul doigt était
    // reconnu et un second (Chi pendant qu'on pilote) était ignoré.
    activePointers: 4,
    // Sur téléphone, un léger appui puis relâchement doit rester un tap.
    touch: { capture: true },
  },
  scene: [BootScene, MenuScene, RunScene, DojoScene, ResultScene],
};

const game = new Phaser.Game(config);

// Phaser convertit les coordonnées d'un toucher à partir d'un rectangle de
// canvas mis en cache. Sur téléphone, ce rectangle bouge (barre d'adresse qui
// se replie, encoche, rotation, clavier) sans toujours déclencher `resize` ;
// un cache périmé décale alors tous les taps de plusieurs dizaines de pixels
// et « plus aucun bouton ne répond ». On le rafraîchit juste avant que Phaser
// ne lise l'événement — écoute en phase de capture, donc avant la sienne.
const refreshBounds = () => { if (game.scale) game.scale.updateBounds(); };
['touchstart', 'pointerdown', 'mousedown'].forEach((ev) =>
  document.addEventListener(ev, refreshBounds, { capture: true, passive: true }));
window.addEventListener('orientationchange', () => setTimeout(() => game.scale.refresh(), 250));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => game.scale.refresh());
}

// Utile pour le playtest depuis la console du navigateur.
window.PandaStampede = { game };

// Diagnostic à l'écran (?debug) : ce qu'il faut pour comprendre un téléphone
// qu'on n'a pas sous la main.
if (window.__diag) {
  const el = window.__diag;
  let last = 'aucun';
  ['touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointerup'].forEach((ev) =>
    document.addEventListener(ev, (e) => {
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      last = `${ev} @ ${Math.round(t.clientX || 0)},${Math.round(t.clientY || 0)}`;
    }, { capture: true, passive: true }));
  setInterval(() => {
    const r = game.canvas.getBoundingClientRect();
    const b = game.scale.canvasBounds;
    const sc = game.scene.getScenes(true).map((s) => s.scene.key).join(',');
    const inset = getComputedStyle(document.getElementById('game')).paddingTop;
    el.textContent =
      `rendu ${game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'}  ${Math.round(game.loop.actualFps)} fps  scène ${sc}\n` +
      `jeu ${game.config.width}x${game.config.height}  écran ${window.innerWidth}x${window.innerHeight}  dpr ${window.devicePixelRatio}\n` +
      `canvas réel ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}  cache ${Math.round(b.x)},${Math.round(b.y)}\n` +
      `encoche haut ${inset}  tactile ${navigator.maxTouchPoints}  dernier ${last}`;
  }, 250);
}

export default game;
