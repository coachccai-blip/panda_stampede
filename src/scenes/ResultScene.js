// ResultScene — bilan de run.
//
// Au-delà des chiffres, l'écran raconte la run en trois « moments forts » :
// c'est ce qui donne envie d'en relancer une, bien plus qu'un tableau de stats.

import { SPECIES } from '../data/enemies.js';
import { SKINS } from '../data/upgrades.js';
import { BIOMES } from '../data/biomes.js';
import { Audio } from '../core/audio.js';
import { FONT, title, body, makeButton, panel } from '../ui/theme.js';

const OUTCOMES = {
  victory: { label: 'ZONE LIBÉRÉE', color: '#4ade80', icon: '🏆' },
  tamed: { label: 'GÉNÉRAL APPRIVOISÉ', color: '#fde68a', icon: '☯' },
  defeat: { label: 'ARMÉE DISPERSÉE', color: '#f87171', icon: '💨' },
  timeout: { label: 'LE GÉNÉRAL TIENT BON', color: '#f87171', icon: '⏳' },
  quit: { label: 'RETRAITE', color: '#cbd5e1', icon: '🚪' },
};

const MODE_LABELS = {
  story: 'Aventure',
  daily: 'Défi du jour',
  endless: 'Marche Infinie',
};

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  init(data) {
    this.summary = data || {};
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const s = this.summary;
    const out = OUTCOMES[s.outcome] || OUTCOMES.defeat;
    const win = s.outcome === 'victory' || s.outcome === 'tamed';
    const newRecord = (s.score || 0) > (s.prevBest || 0) && (s.prevBest || 0) > 0;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x020617, 0x020617, win ? 0x14532d : 0x450a0a, 0x0b1410, 1);
    bg.fillRect(0, 0, W, H);

    this.add.text(W / 2, H * 0.07, out.icon, { fontFamily: FONT, fontSize: '54px' }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.125, out.label, title(32, out.color)).setOrigin(0.5);
    const sub = s.mode === 'endless'
      ? `${MODE_LABELS.endless} · ${(s.leg || 0) + 1} étape${(s.leg || 0) > 0 ? 's' : ''} · ${s.biomeName}`
      : `${MODE_LABELS[s.mode] || MODE_LABELS.story} · ${s.biomeName || ''}`;
    this.add.text(W / 2, H * 0.162, sub, body(15, '#cbd5e1')).setOrigin(0.5);

    // --- score ---
    panel(this, W / 2, H * 0.225, W - 60, 74, {
      fill: 0x0f172a, alpha: 0.75, stroke: win ? 0x4ade80 : 0x475569, strokeAlpha: 0.55,
    });
    this.add.text(W / 2, H * 0.213, `${s.score || 0}`, title(38, '#ffffff')).setOrigin(0.5);
    this.add.text(W / 2, H * 0.245,
      newRecord ? '★ NOUVEAU RECORD' : `record : ${Math.max(s.prevBest || 0, s.score || 0)}`,
      title(14, newRecord ? '#fcd34d' : '#94a3b8')).setOrigin(0.5);

    // --- statistiques, en deux colonnes ---
    const rows = [
      ['🐼 Armée max', String(s.bestArmy || 0)],
      ['🤝 Ralliés', String(s.tamedUnits || 0)],
      ['⚔ Combats', String(s.fought || 0)],
      ['☯ Harmonie', `${Math.round((s.harmony || 0) * 100)} %`],
      ['🔥 Enchaînement', `×${s.bestCombo || 0}`],
      ['🎍 Bambou', `+${s.bamboo || 0}`],
    ];
    const colW = (W - 76) / 2;
    rows.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 38 + col * colW;
      const y = H * 0.295 + row * 30;
      this.add.text(x, y, r[0], body(15, '#cbd5e1')).setOrigin(0, 0.5);
      this.add.text(x + colW - 14, y, r[1], title(16, '#ffffff')).setOrigin(1, 0.5);
    });

    // --- composition (le « waouh » de la diversité) ---
    const comp = s.composition || {};
    const kinds = Object.keys(comp).sort((a, b) => comp[b] - comp[a]);
    this.add.text(W / 2, H * 0.40, 'COMPOSITION FINALE', title(14, '#a3e635')).setOrigin(0.5);
    const line = kinds.map((k) => `${(SPECIES[k] || SPECIES.panda).icon} ${comp[k]}`).join('   ');
    this.add.text(W / 2, H * 0.432, line || '—', body(20, '#ffffff')).setOrigin(0.5);
    if (kinds.length >= 3) {
      this.add.text(W / 2, H * 0.462,
        `${kinds.length} espèces courent ensemble`, body(13, '#fde68a')).setOrigin(0.5);
    }

    // --- moments forts ---
    const highlights = (s.highlights || []).slice(0, 3);
    if (highlights.length) {
      const boxH = 38 + highlights.length * 28;
      panel(this, W / 2, H * 0.545, W - 60, boxH, {
        fill: 0x020617, alpha: 0.55, stroke: 0xfcd34d, strokeAlpha: 0.3,
      });
      this.add.text(W / 2, H * 0.545 - boxH / 2 + 16,
        'MOMENTS FORTS', title(12, '#fcd34d')).setOrigin(0.5);
      highlights.forEach((h, i) => {
        const y = H * 0.545 - boxH / 2 + 40 + i * 28;
        this.add.text(W / 2, y, `${h.icon}  ${h.text}`, body(14, '#e2e8f0')).setOrigin(0.5);
      });
    }

    // --- déblocages ---
    let noteY = H * 0.635;
    if (s.unlockedBiome) {
      const next = BIOMES[(s.biomeIndex || 0) + 1];
      if (next) {
        this.add.text(W / 2, noteY, `🔓 Nouveau biome : ${next.name}`,
          title(18, '#7dd3fc')).setOrigin(0.5);
        noteY += 28;
      } else {
        this.add.text(W / 2, noteY, '🔓 Marche Infinie débloquée',
          title(18, '#7dd3fc')).setOrigin(0.5);
        noteY += 28;
      }
    }
    if (s.unlockedSkin) {
      const skin = SKINS[s.unlockedSkin];
      this.add.text(W / 2, noteY, `🎨 Skin débloqué : ${skin ? skin.name : s.unlockedSkin}`,
        title(18, '#fcd34d')).setOrigin(0.5);
      noteY += 28;
    }
    if (!win && s.outcome !== 'quit') {
      this.add.text(W / 2, noteY, this.advice(s), body(14, '#94a3b8'))
        .setOrigin(0.5).setWordWrapWidth(W - 90).setAlign('center');
      noteY += 30;
    }

    // --- actions ---
    let btnY = Math.max(noteY + 30, H * 0.715);
    if (win && s.unlockedBiome && BIOMES[(s.biomeIndex || 0) + 1]) {
      makeButton(this, W / 2, btnY, 300, 50, '➡ BIOME SUIVANT', {
        fill: 0x0ea5e9, color: '#03212f', fontSize: 20,
        onClick: () => {
          Audio.sfx('ui');
          this.scene.start('Run', { mode: 'story', biomeIndex: (s.biomeIndex || 0) + 1 });
        },
      });
      btnY += 66;
    }

    makeButton(this, W / 2, Math.max(btnY, H * 0.80), 300, 66, 'REJOUER', {
      fontSize: 28,
      onClick: () => {
        Audio.sfx('ui');
        this.scene.start('Run', {
          mode: s.mode || 'story',
          biomeIndex: s.mode === 'endless' ? 0 : (s.biomeIndex || 0),
        });
      },
    });
    makeButton(this, W * 0.29, H * 0.90, 190, 54, '🏯 DOJO', {
      fill: 0x7c3aed, color: '#ffffff', fontSize: 20,
      onClick: () => { Audio.sfx('ui'); this.scene.start('Dojo', { biomeIndex: s.biomeIndex || 0 }); },
    });
    makeButton(this, W * 0.71, H * 0.90, 190, 54, 'MENU', {
      fill: 0x475569, color: '#ffffff', fontSize: 20,
      onClick: () => { Audio.sfx('ui'); this.scene.start('Menu', { biomeIndex: s.biomeIndex || 0 }); },
    });

    if (win) Audio.sfx('win');
    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('Run', {
      mode: s.mode || 'story', biomeIndex: s.biomeIndex || 0,
    }));
    this.events.once('shutdown', () => this.input.keyboard.removeAllListeners());
  }

  /** Conseil ciblé : on regarde ce qui a réellement manqué à cette run. */
  advice(s) {
    if ((s.harmony || 0) < 0.2 && (s.fought || 0) > 2) {
      return 'Tu combats presque toujours. Apprivoiser coûte du temps mais rapporte une armée qui grossit au lieu de fondre.';
    }
    if ((s.bestCombo || 0) <= 2) {
      return 'Enchaîne les décisions justes : la chaîne multiplie le bambou récolté.';
    }
    if ((s.diversity || 1) <= 2) {
      return 'Une armée d\'une seule espèce n\'a qu\'un seul bonus. Varie les ralliements.';
    }
    return 'Astuce : le bon style divise le coût d\'un combat et ouvre la garde des généraux.';
  }
}
