// WorldRenderer — dessine la piste en fuite, les portes, les foules et le boss.
// Silhouettes rondes, couleurs saturées par style, zéro violence graphique (§13).
//
// Perf : aucune allocation dans la boucle de rendu (points de polygone, sprites,
// textes et Graphics sont tous recyclés), et un niveau de qualité adaptatif
// réduit le nombre de segments de piste, de décors et d'unités dessinées si le
// framerate décroche.

import { Camera3D, clamp } from './perspective.js';
import { unitTexture } from './textures.js';
import { UnitPool, LabelPool } from '../entities/AnimalUnit.js';
import { STYLES } from '../data/styles.js';
import { SPECIES } from '../data/enemies.js';
import { gateLabel, gateColor } from '../entities/Gate.js';
import { SHAPE_ICONS } from '../systems/FormationChecker.js';
import { stroked, title } from '../ui/theme.js';

const FAR = 3400;                 // portée de la piste et du décor
const EVENT_FAR = 2150;           // portée des portes et rencontres
const EVENT_FADE = 550;           // longueur du fondu d'apparition
const DEPTH_NEAR = 600;
const DEPTH_FAR = 30;

/**
 * Opacité d'un événement selon sa distance. Sans ce fondu, six rangées de
 * portes s'empilent à l'horizon et plus rien n'est lisible ; avec, l'œil ne
 * voit que les deux ou trois décisions qui le concernent.
 */
export function eventFade(z) {
  if (z <= EVENT_FAR - EVENT_FADE) return 1;
  if (z >= EVENT_FAR) return 0;
  return (EVENT_FAR - z) / EVENT_FADE;
}

const QUALITY = {
  high: {
    roadSteps: 30, sceneryStep: 290, sceneryFar: 2400, edgeFar: 1500,
    maxUnits: 95, enemyUnits: 44, weather: 1, extras: true,
  },
  low: {
    roadSteps: 20, sceneryStep: 520, sceneryFar: 1500, edgeFar: 900,
    maxUnits: 40, enemyUnits: 18, weather: 0.4, extras: false,
  },
};

function depthFor(z) {
  const t = clamp(z / FAR, 0, 1);
  return DEPTH_FAR + (DEPTH_NEAR - DEPTH_FAR) * (1 - t);
}

function hash(i) {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Pool de Graphics : chaque élément a sa propre profondeur d'affichage. */
class GfxPool {
  constructor(scene, capacity = 90) {
    this.scene = scene;
    this.capacity = capacity;
    this.items = [];
    this.index = 0;
  }
  begin() { this.index = 0; }
  obtain(depth) {
    let g;
    if (this.index < this.items.length) g = this.items[this.index++];
    else {
      if (this.items.length >= this.capacity) return null;
      g = this.scene.add.graphics();
      this.items.push(g);
      this.index++;
    }
    g.clear();
    g.setDepth(depth);
    g.setVisible(true);
    return g;
  }
  end() {
    for (let i = this.index; i < this.items.length; i++) {
      this.items[i].clear();
      this.items[i].setVisible(false);
    }
  }
  destroy() { this.items.forEach((g) => g.destroy()); this.items.length = 0; }
}

export class WorldRenderer {
  constructor(scene, biome, quality = 'high') {
    this.scene = scene;
    this.biome = biome;
    this.cam = new Camera3D(scene.scale.width, scene.scale.height);
    this.q = QUALITY[quality] || QUALITY.high;
    this.qualityName = quality;

    // Ciel et vignette sont figés : on les cuit en texture une fois pour toutes
    // plutôt que de rejouer des dizaines de remplissages plein écran à chaque
    // frame. C'est le poste de dépense n°1 sur un GPU limité en fill-rate.
    this.skyImage = scene.add.image(0, 0, this.bakeSky())
      .setOrigin(0).setDepth(0).setScrollFactor(0);
    this.scenery = scene.add.graphics().setDepth(2).setScrollFactor(0);
    this.road = scene.add.graphics().setDepth(4).setScrollFactor(0);
    this.overlay = scene.add.graphics().setDepth(760).setScrollFactor(0);
    this.vignetteImage = scene.add.image(0, 0, this.bakeVignette())
      .setOrigin(0).setDepth(755).setScrollFactor(0);

    this.gfxPool = new GfxPool(scene, 95);
    this.unitPool = new UnitPool(scene, 260);
    this.labelPool = new LabelPool(scene, stroked(26, '#ffffff', 5), 46);
    this.smallLabels = new LabelPool(scene, title(18, '#ffffff'), 32);

    // Points de polygone recyclés : zéro allocation par quad dessiné.
    this._pts = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    this._roadPrev = { lx: 0, ly: 0, rx: 0, ry: 0, z: 0, s: 0 };

    this.weather = [];
    this.initWeather();
  }

  setQuality(name) {
    if (name === this.qualityName) return;
    this.qualityName = name;
    this.q = QUALITY[name] || QUALITY.high;
    this.weather.forEach((w, i) => w.setVisible(i < this.weather.length * this.q.weather));
  }

  // ------------------------------------------------------------------ fond

  /** Cuit le ciel du biome courant en texture et renvoie sa clé. */
  bakeSky() {
    const { width: W, height: H } = this.scene.scale;
    const key = `sky_${this.biome.key}_${Math.round(W)}x${Math.round(H)}`;
    if (this.scene.textures.exists(key)) return key;

    const p = this.biome.palette;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    const horizon = this.cam.horizonY;

    // dégradé de ciel
    const bands = 22;
    const top = Phaser.Display.Color.IntegerToColor(p.skyTop);
    const bot = Phaser.Display.Color.IntegerToColor(p.sky);
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const c = Phaser.Display.Color.GetColor(
        Math.round(top.red + (bot.red - top.red) * t),
        Math.round(top.green + (bot.green - top.green) * t),
        Math.round(top.blue + (bot.blue - top.blue) * t)
      );
      g.fillStyle(c, 1);
      g.fillRect(0, (horizon / bands) * i - 1, W, horizon / bands + 2);
    }

    // astre discret : un halo très doux, jamais une cible au milieu du ciel
    const sx = W * 0.76;
    const sy = horizon * 0.34;
    for (let i = 7; i >= 1; i--) {
      g.fillStyle(p.accent, 0.012 * i);
      g.fillCircle(sx, sy, 14 + i * 13);
    }
    g.fillStyle(p.accent, 0.5);
    g.fillCircle(sx, sy, 15);

    // silhouettes de collines lointaines (deux couches)
    const hill = (baseY, amp, color, alpha, seed) => {
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(0, horizon + 4);
      for (let x = 0; x <= W; x += 24) {
        const y = baseY - Math.abs(Math.sin(x * 0.004 + seed)) * amp
          - Math.abs(Math.sin(x * 0.011 + seed * 2)) * amp * 0.4;
        g.lineTo(x, y);
      }
      g.lineTo(W, horizon + 4);
      g.closePath();
      g.fillPath();
    };
    hill(horizon + 2, 92, p.skyTop, 0.75, 1.2);
    hill(horizon + 3, 54, p.fog, 0.7, 3.7);

    // sol
    g.fillStyle(p.ground, 1);
    g.fillRect(0, horizon - 1, W, H - horizon + 1);

    // brume douce qui noie le point de fuite
    for (let i = 0; i < 6; i++) {
      g.fillStyle(p.fog, 0.14);
      g.fillRect(0, horizon - 18 + i * 6, W, 10);
    }

    g.generateTexture(key, W, H);
    g.destroy();
    return key;
  }

  /** Vignette : concentre le regard sur la piste. Cuite une fois par résolution. */
  bakeVignette() {
    const { width: W, height: H } = this.scene.scale;
    const key = `vignette_${Math.round(W)}x${Math.round(H)}`;
    if (this.scene.textures.exists(key)) return key;

    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const inset = t * Math.min(W, H) * 0.45;
      g.lineStyle(Math.max(10, Math.min(W, H) * 0.05), 0x000000, 0.035);
      g.strokeRect(-inset, -inset, W + inset * 2, H + inset * 2);
    }
    g.generateTexture(key, W, H);
    g.destroy();
    return key;
  }

  initWeather() {
    const kind = this.biome.weather;
    if (!kind) return;
    const { width: W, height: H } = this.scene.scale;
    const count = kind === 'rain' ? 80 : 42;
    for (let i = 0; i < count; i++) {
      const s = this.scene.add.image(Math.random() * W, Math.random() * H,
        kind === 'rain' ? 'drop' : 'spark');
      s.setDepth(700).setScrollFactor(0);
      if (kind === 'rain') {
        s.setTint(0x93c5fd).setAlpha(0.4).setScale(1, Phaser.Math.FloatBetween(0.8, 1.8));
        s.vy = Phaser.Math.Between(900, 1500);
        s.vx = -110;
      } else if (kind === 'embers') {
        s.setTint(0xfb923c).setAlpha(Phaser.Math.FloatBetween(0.3, 0.8))
          .setScale(Phaser.Math.FloatBetween(0.15, 0.4));
        s.vy = -Phaser.Math.Between(60, 180);
        s.vx = Phaser.Math.Between(-40, 40);
      } else {
        s.setTint(0xfbcfe8).setAlpha(Phaser.Math.FloatBetween(0.35, 0.8))
          .setScale(Phaser.Math.FloatBetween(0.18, 0.42));
        s.vy = Phaser.Math.Between(60, 150);
        s.vx = Phaser.Math.Between(-70, 70);
      }
      this.weather.push(s);
    }
  }

  updateWeather(dt, speedRatio = 1) {
    if (!this.weather.length) return;
    const { width: W, height: H } = this.scene.scale;
    const shown = Math.floor(this.weather.length * this.q.weather);
    for (let i = 0; i < this.weather.length; i++) {
      const s = this.weather[i];
      if (i >= shown) { if (s.visible) s.setVisible(false); continue; }
      if (!s.visible) s.setVisible(true);
      s.x += s.vx * dt;
      s.y += s.vy * dt * speedRatio;
      if (s.y > H + 20) { s.y = -20; s.x = Math.random() * W; }
      if (s.y < -20) { s.y = H + 20; s.x = Math.random() * W; }
      if (s.x < -20) s.x = W + 20;
      if (s.x > W + 20) s.x = -20;
    }
  }

  // ---------------------------------------------------------------- décor

  drawScenery(distance, profile) {
    const g = this.scenery;
    g.clear();
    const p = this.biome.palette;
    const step = this.q.sceneryStep;
    const far = this.q.sceneryFar;
    const first = Math.floor(distance / step);
    const count = Math.ceil(far / step);
    for (let i = count; i >= 0; i--) {
      const idx = first + i;
      const z = idx * step - distance;
      if (z < -100 || z > far) continue;
      const half = profile.halfAt(distance + z);
      for (let side = -1; side <= 1; side += 2) {
        const h = hash(idx * 7.3 + (side > 0 ? 91.7 : 3.1));
        if (h < 0.35) continue;
        const off = half + 60 + h * 240;
        const pt = this.cam.project(off * side, z);
        if (pt.y < this.cam.horizonY) continue;
        this.drawProp(g, pt.x, pt.y, (60 + h * 90) * pt.s, pt.s, h, p);
      }
    }
  }

  drawProp(g, x, y, size, s, h, p) {
    const kind = this.biome.key;
    const alpha = clamp(s * 3.4, 0.12, 1);
    if (kind === 'bamboo_forest') {
      g.fillStyle(0x14532d, alpha);
      g.fillRect(x - size * 0.05, y - size * 2.3, size * 0.1, size * 2.3);
      g.fillStyle(0x22c55e, alpha * 0.95);
      g.fillEllipse(x, y - size * 2.35, size * 0.85, size * 0.5);
      g.fillStyle(0x4ade80, alpha * 0.8);
      g.fillEllipse(x - size * 0.28, y - size * 1.95, size * 0.55, size * 0.34);
    } else if (kind === 'wolf_valley') {
      g.fillStyle(0x111827, alpha);
      g.fillTriangle(x - size * 0.75, y, x + size * 0.75, y, x, y - size * 1.6);
      g.fillStyle(0x4b5563, alpha * 0.85);
      g.fillTriangle(x - size * 0.3, y, x + size * 0.55, y, x + size * 0.08, y - size * 1.15);
      g.fillStyle(0xe2e8f0, alpha * 0.5);
      g.fillTriangle(x - size * 0.12, y - size * 1.15, x + size * 0.2, y - size * 1.1, x, y - size * 1.6);
    } else if (kind === 'crystal_marsh') {
      g.fillStyle(0x0891b2, alpha * 0.8);
      g.fillTriangle(x - size * 0.32, y, x + size * 0.32, y, x + size * 0.06, y - size * 1.9);
      g.fillStyle(0xa5f3fc, alpha * 0.55);
      g.fillTriangle(x - size * 0.14, y, x + size * 0.18, y, x + size * 0.02, y - size * 1.35);
    } else if (kind === 'ember_mountain') {
      g.fillStyle(0x1c1917, alpha);
      g.fillTriangle(x - size * 0.85, y, x + size * 0.85, y, x - size * 0.08, y - size * 1.5);
      g.fillStyle(0xea580c, alpha * (0.35 + 0.55 * h));
      g.fillEllipse(x, y - size * 0.08, size * 0.95, size * 0.2);
      g.fillStyle(0xfed7aa, alpha * 0.5 * h);
      g.fillEllipse(x, y - size * 0.08, size * 0.5, size * 0.1);
    } else {
      g.fillStyle(0x312e81, alpha);
      g.fillRect(x - size * 0.2, y - size * 2.3, size * 0.4, size * 2.3);
      g.fillStyle(p.edge, alpha * 0.9);
      g.fillRect(x - size * 0.34, y - size * 2.6, size * 0.68, size * 0.26);
      g.fillStyle(p.edge, alpha * 0.35);
      g.fillCircle(x, y - size * 2.85, size * 0.2);
    }
  }

  // ---------------------------------------------------------------- piste

  drawRoad(distance, profile, edgeAlert = 0) {
    const g = this.road;
    g.clear();
    const p = this.biome.palette;
    const steps = this.q.roadSteps;
    const prev = this._roadPrev;
    let has = false;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const z = FAR * t * t;                       // densité plus forte près du joueur
      const half = profile.halfAt(distance + z);
      const s = this.cam.scaleAt(z);
      const y = this.cam.horizonY + this.cam.span * s;
      const lx = this.cam.cx - half * s;
      const rx = this.cam.cx + half * s;

      if (has) {
        const band = Math.floor((distance + (z + prev.z) / 2) / 300) % 2;
        g.fillStyle(band ? p.road : p.roadAlt, 1);
        this.quad(g, prev.lx, prev.ly, prev.rx, prev.ly, rx, y, lx, y);

        // Bords lumineux — rouges quand l'armée déborde. Inutile de les tracer
        // au loin : ils s'y confondent avec la brume et coûtent deux quads.
        if (z < this.q.edgeFar) {
          const ew = Math.max(1.5, 11 * s);
          g.fillStyle(edgeAlert > 0.02 ? 0xef4444 : p.edge, band ? 0.95 : 0.6);
          this.quad(g, prev.lx - ew, prev.ly, prev.lx, prev.ly, lx, y, lx - ew, y);
          this.quad(g, prev.rx, prev.ly, prev.rx + ew, prev.ly, rx + ew, y, rx, y);
        }
      }
      prev.lx = lx; prev.ly = y; prev.rx = rx; prev.z = z; prev.s = s;
      has = true;
    }

    // Segment terminal : la piste rejoint le point de fuite au lieu de
    // s'arrêter en pointe au milieu du paysage.
    const sEnd = this.cam.scaleAt(60000);
    const yEnd = this.cam.horizonY + this.cam.span * sEnd;
    const halfEnd = profile.halfAt(distance + FAR) * sEnd;
    g.fillStyle(p.road, 1);
    this.quad(g, prev.lx, prev.ly, prev.rx, prev.ly,
      this.cam.cx + halfEnd, yEnd, this.cam.cx - halfEnd, yEnd);

    // brume au point de fuite
    g.fillStyle(p.fog, 0.55);
    g.fillRect(0, this.cam.horizonY - 10, this.scene.scale.width, 40);
  }

  quad(g, ax, ay, bx, by, cx, cy, dx, dy) {
    const p = this._pts;
    p[0].x = ax; p[0].y = ay;
    p[1].x = bx; p[1].y = by;
    p[2].x = cx; p[2].y = cy;
    p[3].x = dx; p[3].y = dy;
    g.fillPoints(p, true);
  }

  strokeQuad(g, ax, ay, bx, by, cx, cy, dx, dy) {
    const p = this._pts;
    p[0].x = ax; p[0].y = ay;
    p[1].x = bx; p[1].y = by;
    p[2].x = cx; p[2].y = cy;
    p[3].x = dx; p[3].y = dy;
    g.strokePoints(p, true, true);
  }

  // --------------------------------------------------------------- overlay

  /**
   * Effets plein écran : lignes de vitesse, teinte d'Éveil, alerte de bord.
   */
  drawOverlay(state) {
    const g = this.overlay;
    g.clear();
    const { width: W, height: H } = this.scene.scale;

    if (state.speedLines > 0.02 && this.q.extras) {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const t = (this.scene.time.now / 240 + i / n) % 1;
        const side = i % 2 === 0 ? -1 : 1;
        const x = W / 2 + side * (W * 0.34 + (i % 5) * 16);
        const y = H * 0.25 + t * H * 0.8;
        g.fillStyle(0xffffff, 0.18 * state.speedLines);
        g.fillRect(x, y, 3, 70 + t * 90);
      }
    }

    if (state.chiGlow > 0.01) {
      const pulse = 0.10 + 0.06 * Math.sin(this.scene.time.now / 120);
      g.fillStyle(0xfcd34d, pulse * state.chiGlow);
      g.fillRect(0, 0, W, H);
    }

    if (state.edgeAlert > 0.02) {
      const a = 0.16 * Math.min(1, state.edgeAlert);
      g.fillStyle(0xef4444, a);
      g.fillRect(0, 0, 26, H);
      g.fillRect(W - 26, 0, 26, H);
    }

    if (state.slowmo > 0.01) {
      g.fillStyle(0x0b1220, 0.20 * state.slowmo);
      g.fillRect(0, 0, W, H * 0.16);
      g.fillRect(0, H * 0.84, W, H * 0.16);
    }
  }

  // ------------------------------------------------------------ éléments

  begin() {
    this.gfxPool.begin();
    this.unitPool.begin();
    this.labelPool.begin();
    this.smallLabels.begin();
  }

  end() {
    this.gfxPool.end();
    this.unitPool.end();
    this.labelPool.end();
    this.smallLabels.end();
  }

  /** Quad vertical (porte, rideau) entre deux x monde, à une profondeur z. */
  drawCurtain(g, x0, x1, z, height, color, alpha, strokeColor, strokeAlpha = 0.95) {
    const s = this.cam.scaleAt(z);
    const yBase = this.cam.horizonY + this.cam.span * s;
    const yTop = yBase - height * s;
    const lx = this.cam.cx + x0 * s;
    const rx = this.cam.cx + x1 * s;
    g.fillStyle(color, alpha);
    this.quad(g, lx, yBase, rx, yBase, rx, yTop, lx, yTop);
    if (strokeColor != null) {
      g.lineStyle(Math.max(2, 6 * s), strokeColor, strokeAlpha);
      this.strokeQuad(g, lx, yBase, rx, yBase, rx, yTop, lx, yTop);
      // barre supérieure pleine : lit mieux la porte de loin
      g.fillStyle(strokeColor, strokeAlpha * 0.95);
      this.quad(g, lx, yTop, rx, yTop, rx, yTop + 10 * s, lx, yTop + 10 * s);
    }
    return { cx: (lx + rx) / 2, cy: (yBase + yTop) / 2, s, yBase, yTop, lx, rx };
  }

  /** Zone au sol (pochoir de formation, bande d'attaque, obstacle). */
  drawGroundZone(g, x0, x1, zNear, zFar, color, alpha) {
    const sn = this.cam.scaleAt(zNear);
    const sf = this.cam.scaleAt(zFar);
    const yn = this.cam.horizonY + this.cam.span * sn;
    const yf = this.cam.horizonY + this.cam.span * sf;
    const lnx = this.cam.cx + x0 * sn;
    const rnx = this.cam.cx + x1 * sn;
    const lfx = this.cam.cx + x0 * sf;
    const rfx = this.cam.cx + x1 * sf;
    g.fillStyle(color, alpha);
    this.quad(g, lnx, yn, rnx, yn, rfx, yf, lfx, yf);
    return { cx: (lnx + rnx + lfx + rfx) / 4, cy: (yn + yf) / 2, s: sn };
  }

  drawGate(ev, z, half) {
    const f = eventFade(z);
    if (f <= 0) return;
    const depth = depthFor(z);
    const g = this.gfxPool.obtain(depth);
    if (!g) return;
    for (let i = 0; i < ev.doors.length; i++) {
      const d = ev.doors[i];
      const color = gateColor(d);
      const q = this.drawCurtain(g, d.f0 * half + 6, d.f1 * half - 6, z, 215,
        color, 0.30 * f, color, 0.95 * f);
      this.labelPool.draw(gateLabel(d, 1), q.cx, q.cy,
        clamp(q.s * 1.5, 0.25, 1.5), depth + 1,
        d.op === 'sub' || d.op === 'div' ? '#fecaca' : '#ffffff', f);
    }
  }

  drawBonusGate(ev, z, half) {
    const f = eventFade(z);
    if (f <= 0) return;
    const depth = depthFor(z);
    const g = this.gfxPool.obtain(depth);
    if (!g) return;
    const q = this.drawCurtain(g, -half * 0.62, half * 0.62, z, 245,
      0xfcd34d, 0.26 * f, 0xfcd34d, 0.95 * f);
    this.labelPool.draw(`${SHAPE_ICONS[ev.shape]} ×2`, q.cx, q.cy,
      clamp(q.s * 1.6, 0.25, 1.6), depth + 1, '#fde68a', f);
  }

  drawFormationPads(ev, z, half) {
    const f = eventFade(z);
    if (f <= 0) return;
    const depth = depthFor(z);
    const g = this.gfxPool.obtain(depth);
    if (!g) return;
    for (let i = 0; i < ev.pads.length; i++) {
      const pad = ev.pads[i];
      const good = pad.shape === ev.shape;
      const zone = this.drawGroundZone(
        g, pad.f0 * half + 8, pad.f1 * half - 8, z, z + 260,
        good ? 0xfcd34d : 0x94a3b8, (good ? 0.34 : 0.15) * f
      );
      this.smallLabels.draw(SHAPE_ICONS[pad.shape], zone.cx, zone.cy,
        clamp(zone.s * 2.4, 0.3, 2.4), depth + 1, good ? '#fde68a' : '#cbd5e1', f);
    }
  }

  drawObstacle(ev, z, half) {
    const f = eventFade(z);
    if (f <= 0) return;
    const depth = depthFor(z);
    const g = this.gfxPool.obtain(depth);
    if (!g) return;
    const x0 = (ev.f - ev.width) * half;
    const x1 = (ev.f + ev.width) * half;
    const hot = this.biome.weather === 'embers';
    this.drawGroundZone(g, x0, x1, z - 60, z + 120, hot ? 0xea580c : 0x0f172a, 0.5 * f);
    const s = this.cam.scaleAt(z);
    const y = this.cam.horizonY + this.cam.span * s;
    const mx = this.cam.cx + ((x0 + x1) / 2) * s;
    g.fillStyle(hot ? 0xfb923c : 0x475569, 0.95 * f);
    g.fillEllipse(mx, y - 18 * s, (x1 - x0) * s, 46 * s);
    g.fillStyle(hot ? 0xfed7aa : 0x94a3b8, 0.85 * f);
    g.fillEllipse(mx, y - 28 * s, (x1 - x0) * 0.55 * s, 24 * s);
  }

  drawToken(ev, z, half) {
    const f = eventFade(z);
    if (f <= 0) return;
    const st = STYLES[ev.style] || STYLES.bamboo;
    const depth = depthFor(z);
    const bob = Math.sin(this.scene.time.now / 260 + ev.phase) * 12;
    const pt = this.cam.project(ev.f * half, z, 58 + bob);
    this.unitPool.draw({
      texture: `token_${st.key}`, x: pt.x, y: pt.y, scale: pt.s * 0.95, depth, alpha: f,
    });
    if (!this.q.extras) return;
    const g = this.gfxPool.obtain(depth - 0.5);
    if (g) {
      g.fillStyle(st.color, 0.2 * f);
      g.fillEllipse(pt.x, this.cam.groundY(z), 62 * pt.s, 18 * pt.s);
    }
  }

  /** Rencontre : la foule ennemie, son badge, et les deux portes du choix. */
  drawEncounter(ev, z, half, time, highlight) {
    const f = eventFade(z);
    if (f <= 0) return;
    const sp = SPECIES[ev.species] || SPECIES.boar;
    const st = STYLES[ev.style] || STYLES.fire;
    const crowdZ = z + 320;
    const depth = depthFor(crowdZ);

    if (!ev.resolved && crowdZ > -200) {
      const limit = Math.min(ev.units.length, this.q.enemyUnits);
      for (let i = 0; i < limit; i++) {
        const u = ev.units[i];
        const bob = Math.abs(Math.sin(time / 170 + u.phase)) * 14;
        const pt = this.cam.project(u.ox, crowdZ + u.oz, bob);
        this.unitPool.draw({
          texture: `unit_${sp.key}`,
          x: pt.x, y: pt.y, scale: pt.s * 0.42, depth: depth + i * 0.01, alpha: f,
        });
      }

      const badge = this.cam.project(0, crowdZ, 225);
      const g = this.gfxPool.obtain(depth + 2);
      if (g) {
        const w = 132 * badge.s;
        const h = 54 * badge.s;
        g.fillStyle(0x020617, 0.82 * f);
        g.fillRoundedRect(badge.x - w / 2, badge.y - h / 2, w, h, 12 * badge.s);
        g.lineStyle(Math.max(1.5, 3 * badge.s), st.color, 0.95 * f);
        g.strokeRoundedRect(badge.x - w / 2, badge.y - h / 2, w, h, 12 * badge.s);
      }
      this.labelPool.draw(`${st.icon} ${ev.count}`, badge.x, badge.y,
        clamp(badge.s * 1.15, 0.2, 1.2), depth + 3, '#ffffff', f);
    }

    if (ev.done) return;
    const depthDoors = depthFor(z);
    const g2 = this.gfxPool.obtain(depthDoors);
    if (!g2) return;
    const fightX = ev.fightLeft ? [-half, 0] : [0, half];
    const tameX = ev.fightLeft ? [0, half] : [-half, 0];

    const pulse = (highlight ? 0.34 + 0.12 * Math.sin(time / 140) : 0.24) * f;
    const qf = this.drawCurtain(g2, fightX[0] + 8, fightX[1] - 4, z, 215,
      0xef4444, pulse, 0xef4444, 0.95 * f);
    const qt = this.drawCurtain(g2, tameX[0] + 4, tameX[1] - 8, z, 215,
      0x22c55e, pulse, 0x22c55e, 0.95 * f);

    // Traînées au sol jusqu'au joueur : on voit où mène chaque porte.
    if (this.q.extras && z < 1500) {
      const a = clamp(1 - z / 1500, 0, 1) * 0.13;
      this.drawGroundZone(g2, fightX[0] + 10, fightX[1] - 6, 0, z, 0xef4444, a);
      this.drawGroundZone(g2, tameX[0] + 6, tameX[1] - 10, 0, z, 0x22c55e, a);
    }

    this.labelPool.draw('⚔', qf.cx, qf.cy, clamp(qf.s * 1.8, 0.25, 1.8),
      depthDoors + 1, '#fecaca', f);
    this.labelPool.draw('🤝', qt.cx, qt.cy, clamp(qt.s * 1.6, 0.22, 1.6),
      depthDoors + 1, '#bbf7d0', f);
  }

  drawBoss(boss, half, time) {
    const sp = SPECIES[boss.def.species] || SPECIES.boar;
    const depth = depthFor(boss.z);

    for (let i = 0; i < boss.attacks.length; i++) {
      const a = boss.attacks[i];
      const g = this.gfxPool.obtain(depthFor(Math.max(a.z, 0)) - 1);
      if (!g) continue;
      const warn = a.z > 420;
      this.drawGroundZone(
        g, a.f0 * half, a.f1 * half, Math.max(a.z - 90, -80), a.z + 90,
        warn ? 0xfbbf24 : 0xef4444, warn ? 0.22 : 0.45
      );
      if (!warn) {
        g.lineStyle(4, 0xffffff, 0.35);
        const s = this.cam.scaleAt(Math.max(a.z, 0));
        const y = this.cam.horizonY + this.cam.span * s;
        g.lineBetween(this.cam.cx + a.f0 * half * s, y, this.cam.cx + a.f1 * half * s, y);
      }
    }

    const bob = Math.abs(Math.sin(boss.bob)) * 26;
    const pt = this.cam.project(boss.x, boss.z, bob);
    const g = this.gfxPool.obtain(depth - 1);
    if (g) {
      const st = STYLES[boss.requiredStyle] || STYLES.fire;
      // aura de garde : trois anneaux respirants
      for (let i = 3; i >= 1; i--) {
        g.fillStyle(st.color, (0.06 + 0.05 * Math.sin(time / 220 + i)) * i * 0.5);
        g.fillEllipse(pt.x, pt.y - 90 * pt.s, (240 + i * 90) * pt.s, (150 + i * 50) * pt.s);
      }
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(pt.x, this.cam.groundY(boss.z), 300 * pt.s, 62 * pt.s);
      if (boss.breachFlash > 0) {
        g.lineStyle(10 * pt.s, 0xffffff, boss.breachFlash * 0.85);
        g.strokeEllipse(pt.x, pt.y - 90 * pt.s, 400 * pt.s, 250 * pt.s);
      }
    }
    this.unitPool.draw({
      texture: `unit_${sp.key}`,
      x: pt.x, y: pt.y, scale: pt.s * 4.2, depth,
      tint: boss.hitFlash > 0.4 ? 0xffdddd : null,
    });
  }

  /** L'armée du joueur : le meneur devant, la masse derrière. */
  drawArmy(army, playerX, skin, time, aura) {
    const units = army.drawable(this.q.maxUnits);
    const n = army.count;
    const scale = 0.42 * (1 - Math.min(0.22, n / 2200));
    const tex = unitTexture('panda', skin);

    // ombre unique sous la masse : beaucoup moins coûteux qu'une par unité
    const shadow = this.gfxPool.obtain(DEPTH_NEAR - 6);
    if (shadow) {
      const pt = this.cam.project(playerX, 0);
      shadow.fillStyle(0x000000, 0.16);
      shadow.fillEllipse(pt.x, pt.y + 4, army.spread * 2.2, army.spread * 0.7 + 18);
    }

    if (aura) {
      const g = this.gfxPool.obtain(DEPTH_NEAR - 5);
      if (g) {
        const pt = this.cam.project(playerX, 0);
        const pulse = 0.16 + 0.1 * Math.sin(time / 120);
        const aw = army.spread * 2.1;
        const ah = army.spread * 1.15;
        g.fillStyle(aura.color, pulse);
        g.fillEllipse(pt.x, pt.y - 34, aw, ah);
        g.lineStyle(5, aura.color, 0.6);
        g.strokeEllipse(pt.x, pt.y - 34, aw, ah);
      }
    }

    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const z = u.oz < -130 ? -130 : u.oz;
      const bob = Math.abs(Math.sin(time / 150 + u.phase)) * 13;
      const s = this.cam.scaleAt(z);
      const y = this.cam.horizonY + this.cam.span * s - bob * s;
      this.unitPool.draw({
        texture: u.species === 'panda' ? tex : `unit_${u.species}`,
        x: this.cam.cx + (playerX + u.ox) * s,
        y,
        scale: s * scale,
        depth: DEPTH_NEAR + i * 0.01,
      });
    }

    const lead = this.cam.project(playerX, -40, Math.abs(Math.sin(time / 140)) * 16);
    this.unitPool.draw({
      texture: tex, x: lead.x, y: lead.y,
      scale: lead.s * scale * 1.35, depth: DEPTH_NEAR + 10,
    });
  }

  setBiome(biome) {
    if (this.biome === biome) return;
    this.biome = biome;
    this.skyImage.setTexture(this.bakeSky());
    // La météo est propre à chaque biome : on la reconstruit à l'étape suivante.
    this.weather.forEach((w) => w.destroy());
    this.weather.length = 0;
    this.initWeather();
  }

  resize() {
    this.cam.resize(this.scene.scale.width, this.scene.scale.height);
    this.skyImage.setTexture(this.bakeSky());
    this.vignetteImage.setTexture(this.bakeVignette());
  }

  destroy() {
    this.skyImage.destroy();
    this.scenery.destroy();
    this.road.destroy();
    this.overlay.destroy();
    this.vignetteImage.destroy();
    this.gfxPool.destroy();
    this.unitPool.destroy();
    this.labelPool.destroy();
    this.smallLabels.destroy();
    this.weather.forEach((w) => w.destroy());
    this.weather.length = 0;
  }
}

export { FAR, EVENT_FAR, depthFor };
