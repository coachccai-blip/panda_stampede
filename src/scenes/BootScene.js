// BootScene — génère les textures procédurales, charge la sauvegarde, puis
// enchaîne sur le menu. Aucun asset externe : le boot est instantané.

import { buildTextures } from '../core/textures.js';
import { Audio } from '../core/audio.js';
import * as Save from '../core/save.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildTextures(this);
    const save = Save.load();
    Audio.setMuted(save.muted);

    // Masque le voile HTML une fois le rendu prêt.
    const boot = document.getElementById('boot');
    if (boot) {
      boot.classList.add('hidden');
      window.setTimeout(() => { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 600);
    }

    this.scene.start('Menu');
  }
}
