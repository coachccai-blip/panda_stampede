// Indicateur de style actif (§12) — gros badge coloré, roue des forces, jauge
// de capacité, et surtout un rappel permanent de ce que le style actuel DOMINE.
// Sans ce rappel, le joueur doit mémoriser la table élémentaire ; avec, il la
// lit en jouant.

import { STYLES, STYLE_KEYS } from '../data/styles.js';
import { FONT, title, body, intToCss } from './theme.js';

export class StyleIndicator {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.current = null;
    const D = 900;

    this.gfx = scene.add.graphics().setDepth(D).setScrollFactor(0);
    this.icon = scene.add.text(x, y - 10, '🎋', { fontFamily: FONT, fontSize: '36px' })
      .setOrigin(0.5).setDepth(D + 2).setScrollFactor(0);
    this.name = scene.add.text(x, y + 20, 'BAMBOU', title(12, '#ffffff'))
      .setOrigin(0.5).setDepth(D + 2).setScrollFactor(0);

    // « bat 🔥 » : la relation clé, toujours sous les yeux
    this.beats = scene.add.text(x, y + 58, '', body(13, '#e2e8f0'))
      .setOrigin(0.5).setDepth(D + 2).setScrollFactor(0);
    this.hint = scene.add.text(x, y + 78, '', body(11, '#94a3b8'))
      .setOrigin(0.5).setDepth(D + 2).setScrollFactor(0);

    this.dots = STYLE_KEYS.map((k, i) => {
      const dx = x - 33 + i * 22;
      const d = scene.add.circle(dx, y - 58, 5, STYLES[k].color, 0.45)
        .setDepth(D + 2).setScrollFactor(0);
      return { key: k, obj: d };
    });
  }

  update(styleKey, cooldown, abilityActive, abilityName) {
    const st = STYLES[styleKey] || STYLES.bamboo;
    const changed = styleKey !== this.current;
    this.current = styleKey;

    const g = this.gfx;
    g.clear();
    g.fillStyle(0x020617, 0.6);
    g.fillCircle(this.x, this.y, 49);
    g.fillStyle(st.colorDark, 0.95);
    g.fillCircle(this.x, this.y, 38);
    g.lineStyle(4, st.color, 1);
    g.strokeCircle(this.x, this.y, 38);

    if (cooldown < 1) {
      g.lineStyle(7, 0x1e293b, 0.9);
      g.strokeCircle(this.x, this.y, 46);
      g.lineStyle(7, 0x64748b, 0.85);
      g.beginPath();
      g.arc(this.x, this.y, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cooldown, false);
      g.strokePath();
    } else {
      const pulse = abilityActive ? 1 : 0.55 + 0.45 * Math.sin(this.scene.time.now / 180);
      g.lineStyle(7, st.color, pulse);
      g.strokeCircle(this.x, this.y, 46);
    }

    this.icon.setText(st.icon);
    this.name.setText(st.short).setColor(intToCss(st.color));
    const beaten = STYLES[st.strongVs];
    this.beats.setText(`bat ${beaten.icon}`);
    this.hint.setText(abilityActive ? abilityName : (cooldown >= 1 ? 'ESPACE' : ''));
    this.hint.setColor(abilityActive ? intToCss(st.color) : '#64748b');

    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      const on = d.key === styleKey;
      d.obj.setAlpha(on ? 1 : 0.3);
      d.obj.setRadius(on ? 7 : 4.5);
    }

    if (changed) {
      this.scene.tweens.add({
        targets: [this.icon], scale: { from: 1.5, to: 1 }, duration: 260, ease: 'Back.out',
      });
    }
  }

  setVisible(v) {
    this.gfx.setVisible(v);
    this.icon.setVisible(v);
    this.name.setVisible(v);
    this.beats.setVisible(v);
    this.hint.setVisible(v);
    this.dots.forEach((d) => d.obj.setVisible(v));
  }
}
