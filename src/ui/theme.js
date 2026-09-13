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

/**
 * Rend un objet cliquable de façon déterministe.
 *
 * Phaser propose `setInteractive()`, mais son test de collision s'est révélé
 * peu fiable ici : selon la taille de la fenêtre, le tout premier clic d'une
 * session n'atteignait jamais l'objet — le pointeur tombait pourtant au centre
 * exact du bouton. Un joueur voyait donc un menu qui ne répondait pas.
 *
 * On teste donc nous-mêmes les coordonnées du pointeur contre un rectangle
 * monde, au niveau de la scène. C'est prévisible, débogable, et ça marche au
 * premier clic comme au centième.
 */
let hoverCount = 0;

function setHover(scene, on, wasOn) {
  if (on === wasOn) return;
  hoverCount = Math.max(0, hoverCount + (on ? 1 : -1));
  scene.input.setDefaultCursor(hoverCount > 0 ? 'pointer' : 'default');
}

export function makeClickable(scene, obj, onClick, opts = {}) {
  const pad = opts.pad || 0;
  let pressed = false;
  let hovering = false;

  const rect = () => {
    if (opts.rect) return opts.rect();
    const b = obj.getBounds();
    return new Phaser.Geom.Rectangle(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2);
  };

  const inside = (p) => {
    if (!obj.visible || obj.enabled === false) return false;
    return Phaser.Geom.Rectangle.Contains(rect(), p.x, p.y);
  };

  const onDown = (p) => {
    if (!inside(p)) return;
    pressed = true;
    // Marque le pointeur comme consommé : la scène de jeu ne doit pas
    // interpréter un appui sur un bouton du HUD comme un ordre de direction.
    p.uiHandled = true;
    if (opts.onPress) opts.onPress();
  };

  const onUp = (p) => {
    if (!pressed) return;
    pressed = false;
    if (opts.onRelease) opts.onRelease();
    if (inside(p)) onClick(p);
  };

  // Le curseur est piloté par un compteur global : plusieurs éléments écoutent
  // le même événement, et sans ça le dernier de la liste remettrait toujours la
  // flèche par-dessus la main de celui qu'on survole vraiment.
  const onMove = (p) => {
    const on = inside(p);
    setHover(scene, on, hovering);
    if (on !== hovering && opts.onHover) opts.onHover(on);
    hovering = on;
  };

  scene.input.on('pointerdown', onDown);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', () => { pressed = false; if (opts.onRelease) opts.onRelease(); });
  scene.input.on('pointermove', onMove);

  obj.once('destroy', () => {
    if (hovering) setHover(scene, false, true);
    scene.input.off('pointerdown', onDown);
    scene.input.off('pointerup', onUp);
    scene.input.off('pointermove', onMove);
  });

  return obj;
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

  let hovering = false;
  makeClickable(scene, c, () => { if (opts.onClick) opts.onClick(); }, {
    // Rectangle explicite : les bounds du container incluraient l'ombre portée.
    rect: () => {
      const m = c.getWorldTransformMatrix();
      const sx = m.scaleX || 1;
      const sy = m.scaleY || 1;
      return new Phaser.Geom.Rectangle(m.tx - (w / 2) * sx, m.ty - (h / 2) * sy, w * sx, h * sy);
    },
    onPress: () => { if (c.enabled) paint(fill, 4); },
    onRelease: () => paint(c.enabled ? fill : fillDim, hovering && c.enabled ? -3 : 0),
    onHover: (on) => {
      if (on === hovering) return;
      hovering = on;
      if (!c.enabled) return;
      paint(fill, on ? -3 : 0);
    },
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
