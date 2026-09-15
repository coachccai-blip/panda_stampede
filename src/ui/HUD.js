// HUD (§12) — compteur d'armée, bambou, progression, combo, formation,
// jauge de Chi (Éveil), barre de boss et retours forts.
//
// Principe de lisibilité : une seule zone par information, jamais de chiffre
// qui saute d'un endroit à l'autre, et tout ce qui est actionnable est en bas
// de l'écran, à portée de pouce.

import { STYLES } from '../data/styles.js';
import { SPECIES } from '../data/enemies.js';
import { SHAPE_ICONS, SHAPE_LABELS } from '../systems/FormationChecker.js';
import { StyleIndicator } from './StyleIndicator.js';
import { FONT, IS_TOUCH, title, body, stroked, intToCss, makeClickable } from './theme.js';

export class HUD {
  constructor(scene, opts = {}) {
    this.scene = scene;
    const W = scene.scale.width;
    const H = scene.scale.height;
    this.W = W;
    this.H = H;
    this.onChi = opts.onChi || (() => {});
    this.onAbility = opts.onAbility || (() => {});
    this.onSteer = opts.onSteer || (() => {});
    this.displayArmy = 0;

    this.gfx = scene.add.graphics().setDepth(870).setScrollFactor(0);

    // --- compteur d'armée ---
    this.armyIcon = scene.add.text(24, 42, '🐼', { fontFamily: FONT, fontSize: '30px' })
      .setOrigin(0, 0.5).setDepth(890).setScrollFactor(0);
    this.armyText = scene.add.text(62, 40, '1', stroked(44))
      .setOrigin(0, 0.5).setDepth(890).setScrollFactor(0);
    this.diversityText = scene.add.text(64, 70, '', body(13, '#a3e635'))
      .setOrigin(0, 0.5).setDepth(890).setScrollFactor(0);
    this.recordTag = scene.add.text(0, 40, '★ RECORD', title(13, '#fcd34d'))
      .setOrigin(0, 0.5).setDepth(890).setScrollFactor(0).setVisible(false);
    this.bossPip = scene.add.text(W - 26, 92, '', { fontFamily: FONT, fontSize: '20px' })
      .setOrigin(0.5).setDepth(890).setScrollFactor(0);

    // --- bambou & combo ---
    this.bambooText = scene.add.text(W - 24, 34, '🎍 0', title(22, '#a3e635'))
      .setOrigin(1, 0.5).setDepth(890).setScrollFactor(0);
    this.comboText = scene.add.text(W - 24, 64, '', title(16, '#fcd34d'))
      .setOrigin(1, 0.5).setDepth(890).setScrollFactor(0);

    // --- style & Chi (bas d'écran, zone des pouces) ---
    this.styleIndicator = new StyleIndicator(scene, 80, H - 118);
    // L'anneau de style est lui-même un bouton : toucher = capacité active.
    this.abilityHit = scene.add.circle(80, H - 118, IS_TOUCH ? 74 : 56, 0xffffff, 0.001)
      .setDepth(903).setScrollFactor(0);
    makeClickable(scene, this.abilityHit, () => this.onAbility());

    // --- flèches de déplacement (tactile seulement) ---
    // Le glissement reste le pilotage fin ; les flèches sont le pilotage sûr :
    // un tap = une voie, impossible de le rater, visible sans explication.
    this.steerButtons = [];
    if (IS_TOUCH) {
      [[-1, W * 0.36, '◀'], [1, W * 0.64, '▶']].forEach(([dir, x, glyph]) => {
        const g = scene.add.graphics().setDepth(900).setScrollFactor(0);
        const bw = 128;
        const bh = 96;
        const y = H - 118;
        const paint = (pressed) => {
          g.clear();
          g.fillStyle(0x020617, pressed ? 0.75 : 0.45);
          g.fillRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 22);
          g.lineStyle(3, 0xa3e635, pressed ? 1 : 0.55);
          g.strokeRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 22);
        };
        paint(false);
        const t = scene.add.text(x, y, glyph, { fontFamily: FONT, fontSize: '40px', color: '#d9f99d' })
          .setOrigin(0.5).setDepth(902).setScrollFactor(0);
        const hit = scene.add.rectangle(x, y, bw + 24, bh + 24, 0xffffff, 0.001)
          .setDepth(903).setScrollFactor(0);
        makeClickable(scene, hit, () => {}, {
          onPress: () => { paint(true); this.onSteer(dir); },
          onRelease: () => paint(false),
        });
        this.steerButtons.push({ g, t, hit });
      });
    }

    this.chiX = W - 80;
    this.chiY = H - 118;
    this.chiGfx = scene.add.graphics().setDepth(900).setScrollFactor(0);
    this.chiIcon = scene.add.text(this.chiX, this.chiY - 2, '☯',
      { fontFamily: FONT, fontSize: '34px' })
      .setOrigin(0.5).setDepth(902).setScrollFactor(0);
    this.chiLabel = scene.add.text(this.chiX, this.chiY + 32, 'CHI', title(13, '#fcd34d'))
      .setOrigin(0.5).setDepth(902).setScrollFactor(0);
    this.chiHint = scene.add.text(this.chiX, this.chiY + 52, '', body(11, '#94a3b8'))
      .setOrigin(0.5).setDepth(902).setScrollFactor(0);
    this.chiHit = scene.add.circle(this.chiX, this.chiY, IS_TOUCH ? 74 : 56, 0xffffff, 0.001)
      .setDepth(903).setScrollFactor(0);
    makeClickable(scene, this.chiHit, () => this.onChi());

    // --- formation ---
    this.formationText = scene.add.text(W / 2, H - 46, '', title(16, '#fcd34d'))
      .setOrigin(0.5).setDepth(890).setScrollFactor(0);

    // --- boss ---
    this.bossName = scene.add.text(W / 2, 112, '', title(17, '#fecaca'))
      .setOrigin(0.5).setDepth(890).setScrollFactor(0).setVisible(false);
    this.bossGuard = scene.add.text(W / 2, 176, '', title(19, '#ffffff'))
      .setOrigin(0.5).setDepth(890).setScrollFactor(0).setVisible(false);
    this.bossTimer = scene.add.text(W - 24, 112, '', title(20, '#fde68a'))
      .setOrigin(1, 0.5).setDepth(890).setScrollFactor(0).setVisible(false);
    this.bossHarmony = scene.add.text(24, 202, '', body(12, '#86efac'))
      .setOrigin(0, 0.5).setDepth(890).setScrollFactor(0).setVisible(false);

    // --- annonces ---
    // Placées à mi-piste : au-dessus des portes proches (la zone de décision,
    // qui doit rester dégagée) et sous l'aperçu de rencontre. Un fond sombre
    // les rend lisibles quel que soit le biome traversé.
    this.bannerBox = scene.add.container(W / 2, H * 0.335)
      .setDepth(895).setScrollFactor(0).setAlpha(0);
    this.bannerBg = scene.add.graphics();
    this.banner = scene.add.text(0, 0, '', stroked(34, '#ffffff', 6)).setOrigin(0.5);
    this.subBanner = scene.add.text(0, 34, '', title(17, '#e2e8f0')).setOrigin(0.5);
    this.bannerBox.add([this.bannerBg, this.banner, this.subBanner]);

    this.pauseBtn = scene.add.text(W / 2, 30, '⏸', { fontFamily: FONT, fontSize: '26px' })
      .setOrigin(0.5).setDepth(892).setScrollFactor(0);
    this.onPause = () => {};
    makeClickable(scene, this.pauseBtn, () => this.onPause(), { pad: 22 });
  }

  update(state) {
    const g = this.gfx;
    g.clear();

    g.fillStyle(0x020617, 0.52);
    g.fillRect(0, 0, this.W, 96);

    // --- barre de progression : fantôme du record + général en bout de piste ---
    const barX = 24;
    const barW = this.W - 62;
    const barY = 88;
    g.fillStyle(0x0f172a, 0.95);
    g.fillRoundedRect(barX, barY, barW, 8, 4);
    g.fillStyle(state.biomeColor || 0xa3e635, 1);
    g.fillRoundedRect(barX, barY, Math.max(6, barW * state.progress), 8, 4);
    if (state.ghost > 0 && state.ghost < 1) {
      g.fillStyle(0xffffff, 0.5);
      g.fillRect(barX + barW * state.ghost - 1.5, barY - 5, 3, 18);
    }
    if (state.progress < 1) {
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(barX + barW * state.progress, barY + 4, 5.5);
    }
    if (this.bossPip.text !== (state.biomeIcon || '')) {
      this.bossPip.setText(state.biomeIcon || '');
    }
    this.bossPip.setAlpha(0.55 + 0.45 * state.progress);

    // --- compteur d'armée, avec inertie visuelle ---
    this.displayArmy += (state.army - this.displayArmy) * 0.25;
    const shown = Math.abs(state.army - this.displayArmy) < 0.8
      ? state.army : Math.round(this.displayArmy);
    this.armyText.setText(String(shown));
    this.armyText.setScale(1 + Math.min(0.3, state.army / 1200));
    this.diversityText.setText(state.diversity > 1 ? `${state.diversity} espèces unies` : '');

    if (state.record) {
      if (!this.recordTag.visible) {
        this.recordTag.setVisible(true);
        this.scene.tweens.add({
          targets: this.recordTag, scale: { from: 1.6, to: 1 }, duration: 300, ease: 'Back.out',
        });
      }
      this.recordTag.setX(this.armyText.x + this.armyText.displayWidth + 12);
      this.recordTag.setAlpha(0.7 + 0.3 * Math.sin(this.scene.time.now / 260));
    } else if (this.recordTag.visible) {
      this.recordTag.setVisible(false);
    }

    this.bambooText.setText(`🎍 ${state.bamboo}`);

    if (state.combo && state.combo.chain >= 2) {
      this.comboText.setText(`${state.combo.label} ×${state.combo.mult}`);
      this.comboText.setAlpha(0.6 + 0.4 * state.combo.window);
    } else if (this.comboText.text) {
      this.comboText.setText('');
    }

    this.styleIndicator.update(
      state.style, state.cooldown, state.abilityActive, state.abilityName
    );
    this.drawChi(state);

    if (state.formation && state.formation.shape) {
      const f = state.formation;
      this.formationText.setText(`${SHAPE_ICONS[f.shape]} ${SHAPE_LABELS[f.shape]} TENUE`);
      this.formationText.setAlpha(0.55 + 0.45 * f.progress);
      const fw = 190;
      g.fillStyle(0x0f172a, 0.85);
      g.fillRoundedRect(this.W / 2 - fw / 2, this.H - 28, fw, 6, 3);
      g.fillStyle(0xfcd34d, 1);
      g.fillRoundedRect(this.W / 2 - fw / 2, this.H - 28, fw * f.progress, 6, 3);
    } else if (this.formationText.text) {
      this.formationText.setText('');
    }

    if (state.boss) this.drawBoss(g, state.boss);
    else if (this.bossName.visible) this.setBossVisible(false);
  }

  drawChi(state) {
    const g = this.chiGfx;
    const x = this.chiX;
    const y = this.chiY;
    g.clear();

    const ready = state.chiReady;
    const active = state.chiActive;
    const ratio = active ? state.chiActiveRatio : state.chi;
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now / 150);

    g.fillStyle(0x020617, 0.6);
    g.fillCircle(x, y, 49);
    g.fillStyle(active ? 0x78350f : ready ? 0x422006 : 0x111827, 0.95);
    g.fillCircle(x, y, 38);
    g.lineStyle(4, active ? 0xfcd34d : ready ? 0xfcd34d : 0x334155, active || ready ? 1 : 0.8);
    g.strokeCircle(x, y, 38);

    g.lineStyle(7, 0x1e293b, 0.9);
    g.strokeCircle(x, y, 46);
    if (ratio > 0) {
      g.lineStyle(7, active ? 0xf59e0b : 0xfcd34d, active ? 1 : 0.9);
      g.beginPath();
      g.arc(x, y, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
      g.strokePath();
    }
    if (ready && !active) {
      g.lineStyle(3, 0xfde68a, 0.35 + 0.5 * pulse);
      g.strokeCircle(x, y, 54);
    }

    this.chiIcon.setAlpha(active ? 1 : ready ? 0.95 : 0.45);
    this.chiIcon.setScale(active ? 1.1 + 0.06 * pulse : ready ? 1 + 0.08 * pulse : 0.9);
    this.chiLabel.setText(active ? 'ÉVEIL' : 'CHI');
    this.chiLabel.setColor(active || ready ? '#fde68a' : '#64748b');
    this.chiHint.setText(active ? '' : ready ? (IS_TOUCH ? 'TAP' : 'TAP / E') : `${Math.round(state.chi * 100)} %`);
    this.chiHint.setColor(ready ? '#fde68a' : '#64748b');
  }

  drawBoss(g, boss) {
    this.setBossVisible(true);
    this.bossName.setText(boss.name);

    const barW = this.W - 92;
    const x = 46;
    const y = 134;
    g.fillStyle(0x020617, 0.9);
    g.fillRoundedRect(x - 5, y - 5, barW + 10, 24, 12);
    g.fillStyle(0x7f1d1d, 1);
    g.fillRoundedRect(x, y, barW, 14, 7);
    g.fillStyle(0xef4444, 1);
    g.fillRoundedRect(x, y, Math.max(2, barW * boss.hp), 14, 7);
    g.lineStyle(2, 0x020617, 0.9);
    for (let i = 1; i < boss.phaseCount; i++) {
      const px = x + (barW * i) / boss.phaseCount;
      g.lineBetween(px, y, px, y + 14);
    }

    const st = STYLES[boss.guard] || STYLES.fire;
    const counter = STYLES[boss.counter] || STYLES.bamboo;
    this.bossGuard.setText(
      boss.breaching
        ? `BRÈCHE OUVERTE ${counter.icon}`
        : `GARDE ${st.icon}  →  RIPOSTE EN ${counter.icon} ${counter.short}`
    );
    this.bossGuard.setColor(boss.breaching ? intToCss(counter.color) : '#e2e8f0');
    this.bossGuard.setScale(boss.breaching ? 1.1 : 1);

    const hw = 150;
    const hx = 46;
    const hy = 198;
    g.fillStyle(0x0f172a, 0.9);
    g.fillRoundedRect(hx, hy, hw, 8, 4);
    g.fillStyle(boss.harmony >= 0.7 ? 0x4ade80 : 0x60a5fa, 1);
    g.fillRoundedRect(hx, hy, hw * boss.harmony, 8, 4);
    g.lineStyle(2, 0x4ade80, 0.95);
    g.lineBetween(hx + hw * 0.7, hy - 4, hx + hw * 0.7, hy + 12);
    this.bossHarmony.setPosition(hx + hw + 10, hy + 4);
    this.bossHarmony.setText(boss.harmony >= 0.7 ? 'harmonie : skin assuré' : 'harmonie');

    const secs = Math.ceil(boss.time / 1000);
    this.bossTimer.setText(`⏳ ${secs}`);
    this.bossTimer.setColor(secs <= 10 ? '#f87171' : '#fde68a');
  }

  setBossVisible(v) {
    this.bossName.setVisible(v);
    this.bossGuard.setVisible(v);
    this.bossTimer.setVisible(v);
    this.bossHarmony.setVisible(v);
  }

  announce(text, sub = '', color = '#ffffff') {
    const s = this.scene;
    this.banner.setText(text).setColor(color);
    this.subBanner.setText(sub);
    this.subBanner.setVisible(!!sub);
    this.banner.setY(sub ? -12 : 0);

    const w = Math.max(this.banner.width, this.subBanner.width) + 56;
    const h = (sub ? 86 : 58);
    const g = this.bannerBg;
    g.clear();
    g.fillStyle(0x020617, 0.62);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.lineStyle(2, 0xffffff, 0.10);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    this.subBanner.setY(sub ? 22 : 0);

    s.tweens.killTweensOf(this.bannerBox);
    this.bannerBox.setAlpha(1).setScale(0.82);
    s.tweens.add({ targets: this.bannerBox, scale: 1, duration: 260, ease: 'Back.out' });
    s.tweens.add({ targets: this.bannerBox, alpha: 0, delay: 950, duration: 420 });
  }

  popup(text, color, x, y) {
    const t = this.scene.add.text(x, y, text, stroked(28, color, 6))
      .setOrigin(0.5).setDepth(896).setScrollFactor(0);
    this.scene.tweens.add({
      targets: t,
      y: y - 80,
      alpha: { from: 1, to: 0 },
      scale: { from: 1.3, to: 0.9 },
      duration: 900,
      ease: 'Quad.out',
      onComplete: () => t.destroy(),
    });
  }

  biomeCard(biome, subtitle) {
    const s = this.scene;
    const c = s.add.container(this.W / 2, this.H * 0.32).setDepth(897).setScrollFactor(0);
    const g = s.add.graphics();
    g.fillStyle(0x020617, 0.82);
    g.fillRoundedRect(-210, -58, 420, 116, 20);
    g.lineStyle(3, biome.palette.edge, 0.9);
    g.strokeRoundedRect(-210, -58, 420, 116, 20);
    const icon = s.add.text(0, -26, biome.icon, { fontFamily: FONT, fontSize: '34px' }).setOrigin(0.5);
    const name = s.add.text(0, 10, biome.name, title(26, '#ffffff')).setOrigin(0.5);
    const sub = s.add.text(0, 38, subtitle || biome.subtitle, body(14, '#cbd5e1')).setOrigin(0.5);
    c.add([g, icon, name, sub]);
    c.setAlpha(0).setScale(0.85);
    s.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 320, ease: 'Back.out' });
    s.tweens.add({
      targets: c, alpha: 0, delay: 1700, duration: 420,
      onComplete: () => c.destroy(),
    });
  }

  speciesJoin(speciesKey, count) {
    const sp = SPECIES[speciesKey] || SPECIES.boar;
    this.announce(
      `${sp.icon} +${count} ${sp.name}${count > 1 ? 's' : ''}`,
      sp.bonusLabel || 'rejoignent ton armée',
      '#86efac'
    );
  }

  destroy() {
    this.gfx.destroy();
    this.chiGfx.destroy();
  }
}
