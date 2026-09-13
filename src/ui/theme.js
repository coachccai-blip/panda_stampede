// Thème visuel partagé par toutes les scènes.

export const FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';

export const COLORS = {
  ink: '#f8fafc',
  inkDim: '#cbd5e1',
  inkFaint: '#94a3b8',
  panel: 0x0f172a,
  panelSoft: 0x1e293b,
  good: '#4ade80',
  goodInt: 0x4ade80,
  bad: '#f87171',
  badInt: 0xf87171,
  fight: 0xef4444,
  tame: 0x22c55e,
  gold: '#fcd34d',
  goldInt: 0xfcd34d,
  bamboo: '#a3e635',
};

export function title(size, color = COLORS.ink) {
  return {
    fontFamily: FONT, fontSize: `${size}px`, color,
    fontStyle: 'bold', align: 'center',
  };
}

export function body(size, color = COLORS.inkDim) {
  return { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' };
}

export function stroked(size, color = COLORS.ink, strokeW = 5) {
  return {
    fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold',
    stroke: '#0b1410', strokeThickness: strokeW, align: 'center',
  };
}

/** Bouton arrondi réutilisable (retourne un container interactif). */
export function makeButton(scene, x, y, w, h, label, opts = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const fill = opts.fill != null ? opts.fill : 0x22c55e;
  const fillDim = opts.fillDim != null ? opts.fillDim : 0x166534;
  const radius = opts.radius != null ? opts.radius : 18;

  const paint = (color, offset = 0) => {
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2, -h / 2 + 6, w, h, radius);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + offset, w, h, radius);
    g.lineStyle(3, 0xffffff, 0.22);
    g.strokeRoundedRect(-w / 2, -h / 2 + offset, w, h, radius);
  };
  paint(fill);

  const t = scene.add.text(0, 0, label, title(opts.fontSize || 28, opts.color || '#062314'))
    .setOrigin(0.5);
  c.add([g, t]);
  c.setSize(w, h);
  c.label = t;
  c.enabled = opts.enabled !== false;

  c.setEnabled = (on) => {
    c.enabled = on;
    paint(on ? fill : fillDim);
    t.setAlpha(on ? 1 : 0.5);
  };
  c.setEnabled(c.enabled);

  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  c.on('pointerover', () => { if (c.enabled) { paint(fill, -3); scene.input.setDefaultCursor('pointer'); } });
  c.on('pointerout', () => { paint(c.enabled ? fill : fillDim); scene.input.setDefaultCursor('default'); });
  c.on('pointerdown', () => { if (c.enabled) paint(fill, 4); });
  c.on('pointerup', () => {
    paint(c.enabled ? fill : fillDim);
    if (c.enabled && opts.onClick) opts.onClick();
  });
  return c;
}

/** Panneau arrondi semi-transparent. */
export function panel(scene, x, y, w, h, opts = {}) {
  const g = scene.add.graphics();
  g.fillStyle(opts.fill != null ? opts.fill : 0x0b1220, opts.alpha != null ? opts.alpha : 0.78);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, opts.radius != null ? opts.radius : 16);
  if (opts.stroke) {
    g.lineStyle(2, opts.stroke, opts.strokeAlpha != null ? opts.strokeAlpha : 0.5);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, opts.radius != null ? opts.radius : 16);
  }
  return g;
}

export function intToCss(int) {
  return '#' + int.toString(16).padStart(6, '0');
}
