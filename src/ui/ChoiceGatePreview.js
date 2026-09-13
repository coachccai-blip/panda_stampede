// ChoiceGatePreview (§12) — l'aperçu qui rend le dilemme lisible.
//
// Trois couches de lecture, du plus lointain au plus immédiat :
//   1. le bandeau : qui arrive, en quel nombre, dans quel style ;
//   2. les deux cartes : l'issue CHIFFRÉE de chaque porte, recalculée en direct
//      quand le joueur change de style — c'est ce qui enseigne la table
//      élémentaire sans une ligne de tutoriel ;
//   3. les marqueurs de bord : de quel CÔTÉ se trouve chaque porte, pour que la
//      décision se prenne au pouce sans quitter la piste des yeux.

import { STYLES } from '../data/styles.js';
import { SPECIES } from '../data/enemies.js';
import { previewFight, previewTame } from '../entities/EnemyGroup.js';
import { FONT, title, body, intToCss } from './theme.js';

export class ChoiceGatePreview {
  constructor(scene) {
    this.scene = scene;
    const W = scene.scale.width;
    const H = scene.scale.height;
    this.W = W;
    this.H = H;
    this.y = H * 0.225;
    this.width = Math.min(W - 24, 672);

    this.edges = scene.add.graphics().setDepth(872).setScrollFactor(0);
    this.edgeLeft = scene.add.text(26, H * 0.56, '', { fontFamily: FONT, fontSize: '34px' })
      .setOrigin(0.5).setDepth(874).setScrollFactor(0).setAlpha(0);
    this.edgeRight = scene.add.text(W - 26, H * 0.56, '', { fontFamily: FONT, fontSize: '34px' })
      .setOrigin(0.5).setDepth(874).setScrollFactor(0).setAlpha(0);

    this.container = scene.add.container(W / 2, this.y).setDepth(880).setScrollFactor(0);
    this.gfx = scene.add.graphics();

    this.enemyIcon = scene.add.text(0, -34, '🐗', { fontFamily: FONT, fontSize: '30px' }).setOrigin(0.5);
    this.enemyCount = scene.add.text(0, -2, '12', title(28, '#ffffff')).setOrigin(0.5);
    this.enemyStyle = scene.add.text(0, 26, '🔥 FEU', title(13, '#f97316')).setOrigin(0.5);

    this.fightTitle = scene.add.text(0, 0, '⚔ COMBAT', title(16, '#fecaca')).setOrigin(0.5);
    this.fightMain = scene.add.text(0, 0, '', title(22, '#ffffff')).setOrigin(0.5);
    this.fightSub = scene.add.text(0, 0, '', body(13, '#fca5a5')).setOrigin(0.5);

    this.tameTitle = scene.add.text(0, 0, '🤝 APPRIVOISER', title(16, '#bbf7d0')).setOrigin(0.5);
    this.tameMain = scene.add.text(0, 0, '', title(22, '#ffffff')).setOrigin(0.5);
    this.tameSub = scene.add.text(0, 0, '', body(13, '#86efac')).setOrigin(0.5);

    this.container.add([
      this.gfx, this.enemyIcon, this.enemyCount, this.enemyStyle,
      this.fightTitle, this.fightMain, this.fightSub,
      this.tameTitle, this.tameMain, this.tameSub,
    ]);
    this.container.setVisible(false).setAlpha(0);
    this.encounter = null;
  }

  show(encounter) {
    if (this.encounter === encounter) return;
    this.encounter = encounter;
    this.container.setVisible(true);
    this.scene.tweens.killTweensOf(this.container);
    this.container.setScale(0.92);
    this.scene.tweens.add({
      targets: this.container, alpha: 1, scale: 1, duration: 240, ease: 'Back.out',
    });
  }

  hide() {
    if (!this.encounter) return;
    this.encounter = null;
    this.edges.clear();
    this.edgeLeft.setAlpha(0);
    this.edgeRight.setAlpha(0);
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 180,
      onComplete: () => this.container.setVisible(false),
    });
  }

  /**
   * @param {object} ctx contexte de résolution (armée, style, bonus)
   * @param {boolean} fightLeft la porte de combat est-elle à gauche ?
   * @param {number} approach 0 (loin) → 1 (au contact)
   * @param {number} playerSide -1 gauche / 1 droite : quelle porte est visée
   */
  update(ctx, fightLeft, approach, playerSide) {
    if (!this.encounter) return;
    const enc = this.encounter;
    const sp = SPECIES[enc.species] || SPECIES.boar;
    const st = STYLES[enc.style] || STYLES.fire;

    const fight = previewFight(ctx);
    const tame = previewTame(ctx);

    const W = this.width;
    const H = 112;
    const cardW = W * 0.35;
    const cardH = 88;
    const leftX = -W / 2 + cardW / 2 + 6;
    const rightX = W / 2 - cardW / 2 - 6;
    const fightX = fightLeft ? leftX : rightX;
    const tameX = fightLeft ? rightX : leftX;

    const aimingFight = (playerSide < 0) === !!fightLeft;

    const g = this.gfx;
    g.clear();
    g.fillStyle(0x020617, 0.78);
    g.fillRoundedRect(-W / 2, -H / 2, W, H, 18);
    g.lineStyle(2, st.color, 0.5);
    g.strokeRoundedRect(-W / 2, -H / 2, W, H, 18);

    // Jauge d'approche : le joueur voit le temps qu'il lui reste pour décider.
    g.fillStyle(0x1e293b, 0.9);
    g.fillRoundedRect(-W / 2 + 14, H / 2 - 9, W - 28, 5, 3);
    g.fillStyle(st.color, 0.95);
    g.fillRoundedRect(-W / 2 + 14, H / 2 - 9, (W - 28) * approach, 5, 3);

    // carte COMBAT
    this.card(g, fightX, cardW, cardH, fight.win ? 0x7f1d1d : 0x450a0a,
      fight.win ? 0xef4444 : 0x991b1b, aimingFight);
    // carte APPRIVOISER
    const tameHot = tame.chance >= 0.6;
    this.card(g, tameX, cardW, cardH, tameHot ? 0x14532d : 0x1c2f22,
      tameHot ? 0x22c55e : 0x4d7c4f, !aimingFight);

    this.enemyIcon.setText(sp.icon);
    this.enemyCount.setText(String(enc.count));
    this.enemyStyle.setText(`${st.icon} ${st.short}`).setColor(intToCss(st.color));

    this.fightTitle.setPosition(fightX, -32);
    this.fightMain.setPosition(fightX, -3);
    this.fightSub.setPosition(fightX, 24);
    this.fightMain.setText(fight.win ? `−${fight.losses}` : 'RISQUÉ');
    this.fightMain.setColor(fight.win ? '#ffffff' : '#fca5a5');
    this.fightSub.setText(fight.win ? `reste ${fight.remaining}` : `−${fight.losses} unités`);

    this.tameTitle.setPosition(tameX, -32);
    this.tameMain.setPosition(tameX, -3);
    this.tameSub.setPosition(tameX, 24);
    this.tameMain.setText(tame.chance >= 1 ? 'SÛR' : `${Math.round(tame.chance * 100)} %`);
    this.tameMain.setColor(tameHot ? '#86efac' : '#fde68a');
    this.tameSub.setText(`+${tame.fullGain} ${sp.name.toLowerCase()}${tame.fullGain > 1 ? 's' : ''}`);

    if (tame.styleMatch === 1) this.tameSub.setColor('#4ade80');
    else if (tame.styleMatch === -1) this.tameSub.setColor('#fca5a5');
    else this.tameSub.setColor('#d9f99d');

    this.drawEdges(fightLeft, approach);
  }

  card(g, x, w, h, fill, stroke, selected) {
    g.fillStyle(fill, 0.94);
    g.fillRoundedRect(x - w / 2, -h / 2, w, h, 14);
    g.lineStyle(selected ? 4 : 2, stroke, selected ? 1 : 0.85);
    g.strokeRoundedRect(x - w / 2, -h / 2, w, h, 14);
    if (selected) {
      g.fillStyle(stroke, 0.9);
      g.fillTriangle(x - 9, h / 2 + 4, x + 9, h / 2 + 4, x, h / 2 + 16);
    }
  }

  /** Rappels de bord : quelle porte est de quel côté, vu du coin de l'œil. */
  drawEdges(fightLeft, approach) {
    const g = this.edges;
    g.clear();
    const a = Math.min(1, approach * 1.4) * 0.5;
    if (a <= 0.02) return;
    const H = this.H;
    const top = H * 0.40;
    const h = H * 0.34;
    const leftColor = fightLeft ? 0xef4444 : 0x22c55e;
    const rightColor = fightLeft ? 0x22c55e : 0xef4444;

    // Dégradé fin collé au bord : un repère périphérique, pas un bandeau.
    for (let i = 0; i < 5; i++) {
      const w = 20 - i * 4;
      const al = a * (0.22 - i * 0.04);
      if (al <= 0) continue;
      g.fillStyle(leftColor, al);
      g.fillRoundedRect(0, top, w, h, 6);
      g.fillStyle(rightColor, al);
      g.fillRoundedRect(this.W - w, top, w, h, 6);
    }
    this.edgeLeft.setText(fightLeft ? '⚔' : '🤝').setAlpha(Math.min(1, a * 1.9));
    this.edgeRight.setText(fightLeft ? '🤝' : '⚔').setAlpha(Math.min(1, a * 1.9));
  }

  destroy() {
    this.container.destroy();
    this.edges.destroy();
    this.edgeLeft.destroy();
    this.edgeRight.destroy();
  }
}
