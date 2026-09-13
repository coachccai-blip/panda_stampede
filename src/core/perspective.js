// Projection pseudo-3D : la piste fuit vers l'horizon, l'armée reste au premier
// plan à z = 0. Tout le monde (portes, ennemis, jetons) vit dans un espace
// (worldX, z) et se projette en (x, y, scale) à l'écran.

export const FOCAL = 900;

export class Camera3D {
  constructor(width, height) {
    this.resize(width, height);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.cx = width / 2;
    this.horizonY = height * 0.205;
    this.playerY = height * 0.80;
    this.span = this.playerY - this.horizonY;
  }

  /** Facteur d'échelle : 1 au premier plan, → 0 à l'horizon. */
  scaleAt(z) {
    return FOCAL / (FOCAL + Math.max(z, -FOCAL * 0.85));
  }

  /**
   * @param {number} worldX position latérale (0 = centre de piste)
   * @param {number} z profondeur (0 = plan du joueur)
   * @param {number} lift hauteur au-dessus du sol (unités monde)
   */
  project(worldX, z, lift = 0) {
    const s = this.scaleAt(z);
    return {
      x: this.cx + worldX * s,
      y: this.horizonY + this.span * s - lift * s,
      s,
    };
  }

  /** Y au sol pour une profondeur donnée (utile pour les ombres). */
  groundY(z) {
    return this.horizonY + this.span * this.scaleAt(z);
  }
}

/**
 * Profil de largeur de piste (§6 : « cap dynamique »).
 * Les rétrécissements sont des segments [zStart, zEnd] avec une demi-largeur cible.
 */
export class TrackProfile {
  constructor(baseHalf) {
    this.baseHalf = baseHalf;
    this.segments = [];
  }

  addNarrow(start, end, half) {
    this.segments.push({ start, end, half });
    this.segments.sort((a, b) => a.start - b.start);
  }

  /** Demi-largeur de piste à la distance absolue donnée, avec transitions douces. */
  halfAt(distance) {
    let half = this.baseHalf;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (distance < seg.start - 400 || distance > seg.end + 400) continue;
      const fadeIn = clamp01((distance - (seg.start - 400)) / 400);
      const fadeOut = clamp01(((seg.end + 400) - distance) / 400);
      const t = Math.min(fadeIn, fadeOut);
      half = Math.min(half, lerp(this.baseHalf, seg.half, t));
    }
    return half;
  }
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Interpolation indépendante du framerate. */
export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}
