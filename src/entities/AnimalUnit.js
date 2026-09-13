// Pool de sprites d'unités : on recycle des Images Phaser au lieu d'en créer /
// détruire à chaque frame. Une armée de 400 pandas ne coûte que ~90 sprites
// dessinés (échantillonnage dans ArmyManager).

export class UnitPool {
  constructor(scene, capacity = 160) {
    this.scene = scene;
    this.capacity = capacity;
    this.sprites = [];
    this.index = 0;
  }

  begin() {
    this.index = 0;
  }

  obtain() {
    if (this.index < this.sprites.length) return this.sprites[this.index++];
    if (this.sprites.length >= this.capacity) return null;
    const s = this.scene.add.image(0, 0, 'unit_panda');
    s.setOrigin(0.5, 1);
    this.sprites.push(s);
    this.index++;
    return s;
  }

  /**
   * @param {object} cfg { texture, x, y, scale, depth, tint, alpha, angle }
   */
  draw(cfg) {
    const s = this.obtain();
    if (!s) return null;
    if (s.texture.key !== cfg.texture) s.setTexture(cfg.texture);
    s.setPosition(cfg.x, cfg.y);
    s.setScale(cfg.scale);
    s.setDepth(cfg.depth);
    s.setAlpha(cfg.alpha == null ? 1 : cfg.alpha);
    s.setAngle(cfg.angle || 0);
    if (cfg.tint != null) s.setTint(cfg.tint); else s.clearTint();
    s.setVisible(true);
    return s;
  }

  end() {
    for (let i = this.index; i < this.sprites.length; i++) this.sprites[i].setVisible(false);
  }

  destroy() {
    this.sprites.forEach((s) => s.destroy());
    this.sprites.length = 0;
  }
}

/**
 * Pool de textes réutilisables (étiquettes de portes, compteurs ennemis).
 * Même principe : aucune allocation pendant la course.
 */
export class LabelPool {
  constructor(scene, style, capacity = 40) {
    this.scene = scene;
    this.style = style;
    this.capacity = capacity;
    this.items = [];
    this.index = 0;
  }

  begin() {
    this.index = 0;
  }

  draw(text, x, y, scale, depth, color, alpha) {
    let t;
    if (this.index < this.items.length) {
      t = this.items[this.index++];
    } else {
      if (this.items.length >= this.capacity) return null;
      t = this.scene.add.text(0, 0, '', this.style).setOrigin(0.5);
      this.items.push(t);
      this.index++;
    }
    if (t.text !== text) t.setText(text);
    t.setPosition(x, y);
    t.setScale(scale);
    t.setDepth(depth);
    t.setAlpha(alpha == null ? 1 : alpha);
    if (color) t.setColor(color);
    t.setVisible(true);
    return t;
  }

  end() {
    for (let i = this.index; i < this.items.length; i++) this.items[i].setVisible(false);
  }

  destroy() {
    this.items.forEach((t) => t.destroy());
    this.items.length = 0;
  }
}
