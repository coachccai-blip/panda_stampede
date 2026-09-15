// MenuScene — titre, choix du mode et du biome, accès au Dojo.
//
// Trois modes cohabitent : l'Aventure (progression par biome), le Défi du jour
// (même graine pour tout le monde, un score à battre) et la Marche Infinie
// (les biomes s'enchaînent, la difficulté monte). Les deux derniers existent
// pour donner une raison de relancer une run quand l'histoire est finie.

import { BIOMES } from '../data/biomes.js';
import { STYLES } from '../data/styles.js';
import { Audio } from '../core/audio.js';
import { unitTexture } from '../core/textures.js';
import * as Save from '../core/save.js';
import { FONT, IS_TOUCH, title, body, makeButton, makeClickable, panel } from '../ui/theme.js';

const MODES = [
  { key: 'story', label: 'AVENTURE', icon: '🗺️' },
  { key: 'daily', label: 'DÉFI DU JOUR', icon: '📅' },
  { key: 'endless', label: 'INFINI', icon: '♾️' },
];

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  init(data) {
    this.startIndex = (data && data.biomeIndex) || 0;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const save = Save.get();
    this.save = save;
    this.index = Math.min(this.startIndex, Math.max(0, save.biomesUnlocked - 1));
    this.mode = save.lastMode === 'endless' && !save.endlessUnlocked ? 'story' : (save.lastMode || 'story');

    this.buildBackground(W, H);

    this.add.text(W / 2, H * 0.075, '🐼', { fontFamily: FONT, fontSize: '68px' }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.142, 'PANDA STAMPEDE', title(42, '#f8fafc')).setOrigin(0.5);
    this.add.text(W / 2, H * 0.178, 'Unis-les. Ne les écrase pas.', body(17, '#a3e635')).setOrigin(0.5);

    // --- sélecteur de mode ---
    this.modeTabs = MODES.map((m, i) => {
      const x = W * (0.19 + i * 0.31);
      const t = this.add.text(x, H * 0.225, `${m.icon} ${m.label}`, title(14, '#94a3b8'))
        .setOrigin(0.5);
      makeClickable(this, t, () => this.setMode(m.key), { pad: 14 });
      return { key: m.key, obj: t };
    });
    this.modeUnderline = this.add.graphics();

    // --- carte centrale (contenu variable selon le mode) ---
    this.cardGfx = this.add.graphics();
    this.cardIcon = this.add.text(W / 2, H * 0.325, '', { fontFamily: FONT, fontSize: '50px' }).setOrigin(0.5);
    this.cardTitle = this.add.text(W / 2, H * 0.383, '', title(27)).setOrigin(0.5);
    this.cardSub = this.add.text(W / 2, H * 0.418, '', body(15, '#cbd5e1')).setOrigin(0.5);
    this.cardLine = this.add.text(W / 2, H * 0.452, '', body(14, '#fca5a5')).setOrigin(0.5);
    this.cardNote = this.add.text(W / 2, H * 0.487, '', title(15, '#fcd34d')).setOrigin(0.5);

    const arrowStyle = { fontFamily: FONT, fontSize: '42px', color: '#a3e635' };
    this.prevBtn = this.add.text(W * 0.1, H * 0.385, '‹', arrowStyle).setOrigin(0.5);
    this.nextBtn = this.add.text(W * 0.9, H * 0.385, '›', arrowStyle).setOrigin(0.5);
    makeClickable(this, this.prevBtn, () => this.move(-1), { pad: 26 });
    makeClickable(this, this.nextBtn, () => this.move(1), { pad: 26 });

    // --- actions ---
    this.playBtn = makeButton(this, W / 2, H * 0.575, 300, 78, 'COURIR', {
      fontSize: 32,
      onClick: () => this.startRun(),
    });
    makeButton(this, W / 2, H * 0.672, 300, 58, '🏯 DOJO', {
      fill: 0x7c3aed, color: '#ffffff', fontSize: 24,
      onClick: () => { Audio.sfx('ui'); this.scene.start('Dojo', { biomeIndex: this.index }); },
    });

    panel(this, W / 2, H * 0.768, W - 56, 84, {
      fill: 0x020617, alpha: 0.58, stroke: 0x4ade80, strokeAlpha: 0.3,
    });
    this.statsText = this.add.text(W / 2, H * 0.768, '', body(15, '#e2e8f0'))
      .setOrigin(0.5).setAlign('center').setLineSpacing(6);

    this.add.text(W / 2, H * 0.85,
      IS_TOUCH
        ? '◀ ▶ ou glisse pour diriger   ·   anneau : capacité   ·   ☯ : Éveil'
        : '← →  ou glisse   ·   ESPACE  capacité   ·   E  Éveil',
      body(14, '#94a3b8')).setOrigin(0.5);

    // --- installation sur l'écran d'accueil ---
    // Caché une fois installé (mode standalone) : le bouton n'a plus de sens.
    const standalone = typeof window.__isStandalone === 'function' && window.__isStandalone();
    if (!standalone) {
      this.installBtn = makeButton(this, 118, 34, 200, 44, '📲 Installer', {
        fill: 0x0f172a, color: '#a7f3d0', fontSize: 17, radius: 14,
        onClick: () => {
          Audio.sfx('ui');
          if (typeof window.__requestInstall === 'function') window.__requestInstall();
        },
      });
    }

    // --- roue des styles ---
    const wheelY = H * 0.905;
    const order = ['bamboo', 'fire', 'wind', 'water'];
    order.forEach((k, i) => {
      const st = STYLES[k];
      const x = W / 2 + (i - 1.5) * 76;
      this.add.text(x, wheelY, st.icon, { fontFamily: FONT, fontSize: '26px' }).setOrigin(0.5);
      if (i < 3) {
        this.add.text(x + 38, wheelY, '›',
          { fontFamily: FONT, fontSize: '20px', color: '#64748b' }).setOrigin(0.5);
      }
    });
    this.add.text(W / 2, wheelY + 30, 'chaque style domine le suivant', body(12, '#64748b')).setOrigin(0.5);

    this.muteBtn = this.add.text(W - 34, 34, save.muted ? '🔇' : '🔊',
      { fontFamily: FONT, fontSize: '26px' }).setOrigin(0.5);
    makeClickable(this, this.muteBtn, () => {
      const m = !this.save.muted;
      Save.setMuted(m);
      Audio.setMuted(m);
      this.muteBtn.setText(m ? '🔇' : '🔊');
    }, { pad: 18 });

    this.input.once('pointerdown', () => {
      Audio.resume(); Audio.startMusic('run'); Audio.setIntensity(1);
    });
    this.input.keyboard.on('keydown-ENTER', () => this.startRun());
    this.input.keyboard.on('keydown-SPACE', () => this.startRun());
    this.input.keyboard.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.move(1));

    this.setMode(this.mode);
    this.events.once('shutdown', () => this.input.keyboard.removeAllListeners());
  }

  /** Fond animé : une petite troupe traverse le bas de l'écran en boucle. */
  buildBackground(W, H) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0b1f17, 0x0b1f17, 0x14532d, 0x1c3b2c, 1);
    bg.fillRect(0, 0, W, H);

    for (let i = 0; i < 9; i++) {
      const x = (i / 8) * W + Phaser.Math.Between(-20, 20);
      const g = this.add.graphics().setAlpha(0.14);
      g.fillStyle(0x4ade80, 1);
      g.fillRect(x, 0, 14, H);
      for (let y = 60; y < H; y += 140) {
        g.fillStyle(0x166534, 1);
        g.fillRect(x - 3, y, 20, 8);
      }
    }

    const skin = Save.get().skin || 'default';
    const cast = ['panda', 'panda', 'wolf', 'panda', 'boar', 'panda', 'eagle'];
    cast.forEach((sp, i) => {
      const known = sp === 'panda' || Save.get().codex[sp];
      // Collés au bord inférieur, sous la roue des styles quelle que soit la hauteur d'écran.
      const y = H - 2 + (i % 3) * 5;
      const img = this.add.image(-80, y, unitTexture(known ? sp : 'panda', skin))
        .setOrigin(0.5, 1).setScale(0.46).setAlpha(0.85).setDepth(1);
      const run = () => {
        img.x = -80 - i * 40;
        this.tweens.add({
          targets: img,
          x: W + 100,
          duration: Phaser.Math.Between(7000, 10000),
          delay: i * 420,
          onComplete: run,
        });
      };
      run();
      this.tweens.add({
        targets: img, y: y - 10, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
    });
  }

  setMode(key) {
    if (key === 'endless' && !this.save.endlessUnlocked) {
      Audio.sfx('deny');
      this.flashNote('Termine l\'Aventure pour ouvrir la Marche Infinie');
      return;
    }
    this.mode = key;
    this.save.lastMode = key;
    Save.save();
    Audio.sfx('ui');
    this.modeTabs.forEach((t) => {
      const active = t.key === this.mode;
      const locked = t.key === 'endless' && !this.save.endlessUnlocked;
      t.obj.setColor(active ? '#fcd34d' : locked ? '#475569' : '#94a3b8');
      t.obj.setScale(active ? 1.06 : 1);
    });
    const active = this.modeTabs.find((t) => t.key === this.mode);
    this.modeUnderline.clear();
    if (active) {
      this.modeUnderline.fillStyle(0xfcd34d, 1);
      this.modeUnderline.fillRoundedRect(
        active.obj.x - active.obj.width / 2 - 6, this.scale.height * 0.243,
        active.obj.width + 12, 4, 2
      );
    }
    this.refresh();
  }

  flashNote(text) {
    this.cardNote.setText(text).setColor('#fca5a5');
    this.tweens.add({ targets: this.cardNote, alpha: { from: 1, to: 1 }, duration: 10 });
  }

  move(dir) {
    if (this.mode !== 'story') return;
    const next = Phaser.Math.Clamp(this.index + dir, 0, BIOMES.length - 1);
    if (next === this.index) return;
    this.index = next;
    Audio.sfx('ui');
    this.refresh();
    this.tweens.add({
      targets: [this.cardIcon, this.cardTitle],
      scale: { from: 0.82, to: 1 }, duration: 200, ease: 'Back.out',
    });
  }

  refresh() {
    const W = this.scale.width;
    const H = this.scale.height;
    const g = this.cardGfx;
    const s = this.save;
    const arrows = this.mode === 'story';
    this.prevBtn.setVisible(arrows);
    this.nextBtn.setVisible(arrows);

    let palette = BIOMES[this.index].palette;
    let unlocked = true;

    if (this.mode === 'story') {
      const b = BIOMES[this.index];
      palette = b.palette;
      unlocked = this.index < s.biomesUnlocked;
      const best = Save.bestFor(b.key);
      this.cardIcon.setText(unlocked ? b.icon : '🔒').setAlpha(unlocked ? 1 : 0.6);
      this.cardTitle.setText(b.name).setAlpha(unlocked ? 1 : 0.55);
      this.cardSub.setText(b.subtitle).setAlpha(unlocked ? 1 : 0.4);
      this.cardLine.setText(unlocked ? `${b.boss.icon} ${b.boss.name}` : '').setColor('#fca5a5');
      this.cardNote.setText(
        unlocked
          ? (best ? `Meilleur score : ${best.score}   ·   armée ${best.army}` : 'jamais parcouru')
          : `Termine « ${BIOMES[Math.max(0, this.index - 1)].name} » pour débloquer`
      ).setColor(unlocked ? '#fcd34d' : '#fca5a5');
      this.prevBtn.setAlpha(this.index > 0 ? 1 : 0.25);
      this.nextBtn.setAlpha(this.index < BIOMES.length - 1 ? 1 : 0.25);
    } else if (this.mode === 'daily') {
      const seed = Save.dailySeed();
      const b = BIOMES[seed % BIOMES.length];
      palette = b.palette;
      const today = Save.todayKey();
      const todayScore = s.dailyDate === today ? s.dailyScore : 0;
      this.cardIcon.setText('📅').setAlpha(1);
      this.cardTitle.setText('Défi du jour').setAlpha(1);
      this.cardSub.setText(`${b.icon} ${b.name} · même piste pour tout le monde`).setAlpha(1);
      this.cardLine.setText(`graine ${seed % 100000}`).setColor('#94a3b8');
      this.cardNote.setText(
        todayScore ? `Ton score du jour : ${todayScore}` : 'pas encore tenté aujourd\'hui'
      ).setColor('#fcd34d');
    } else {
      palette = BIOMES[BIOMES.length - 1].palette;
      this.cardIcon.setText('♾️').setAlpha(1);
      this.cardTitle.setText('Marche Infinie').setAlpha(1);
      this.cardSub.setText('les biomes s\'enchaînent, la difficulté monte').setAlpha(1);
      this.cardLine.setText('la run s\'arrête quand l\'armée s\'éteint').setColor('#94a3b8');
      this.cardNote.setText(
        s.endlessBest ? `Record : ${s.endlessBest}` : 'aucun record'
      ).setColor('#fcd34d');
    }

    g.clear();
    g.fillStyle(palette.sky, 0.88);
    g.fillRoundedRect(W * 0.09, H * 0.272, W * 0.82, H * 0.245, 22);
    g.lineStyle(3, unlocked ? palette.edge : 0x475569, 0.9);
    g.strokeRoundedRect(W * 0.09, H * 0.272, W * 0.82, H * 0.245, 22);

    this.playBtn.setEnabled(unlocked);
    this.playBtn.label.setText(this.mode === 'endless' ? 'MARCHER' : 'COURIR');

    const codex = Save.codexCount();
    this.statsText.setText([
      `🎍 ${s.bamboo} bambou   ·   🐼 record d'armée : ${s.bestArmy}`,
      `📖 codex ${codex}/6   ·   🤝 ${s.tamedTotal} ralliés   ·   ${s.runs} run${s.runs > 1 ? 's' : ''}`,
    ].join('\n'));
  }

  startRun() {
    if (this.mode === 'story' && this.index >= this.save.biomesUnlocked) {
      Audio.sfx('deny');
      return;
    }
    Audio.resume();
    Audio.sfx('ui');
    this.scene.start('Run', { mode: this.mode, biomeIndex: this.mode === 'endless' ? 0 : this.index });
  }
}
