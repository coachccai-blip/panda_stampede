// ArmyManager — la masse, sa composition et sa géométrie.
// C'est ici que vit l'équilibre Yin-Yang (§4.C) : la taille de l'armée dicte
// son encombrement, donc sa maniabilité et sa vulnérabilité sur les bords.
//
// Perf : composition, bonus, échantillonnage d'affichage et ordre de tri sont
// mis en cache et invalidés par un compteur de version. Sans ça, une armée de
// 400 unités relançait une dizaine de parcours complets à chaque frame.

import { SPECIES, BONUS_CAPS } from '../data/enemies.js';

const GOLDEN = 2.39996323;

export class ArmyManager {
  constructor(options = {}) {
    this.units = [];
    this.formation = 'blob';
    this.formationTimer = 0;
    this.maxDrawn = options.maxDrawn || 90;
    this.version = 0;
    this._compVersion = -1;
    this._comp = {};
    this._bonusVersion = -1;
    this._bonuses = {};
    this._drawVersion = -1;
    this._drawMax = -1;
    this._drawable = [];
    this.reset(options.startCount || 1, options.companions || []);
  }

  touch() {
    this.version++;
  }

  reset(startCount, companions = []) {
    this.units.length = 0;
    for (let i = 0; i < startCount; i++) this.push('panda');
    companions.forEach((c) => {
      for (let i = 0; i < c.count; i++) this.push(c.key);
    });
    this.layout();
  }

  push(species) {
    this.units.push({
      species,
      ox: 0,
      oz: 0,
      phase: Math.random() * Math.PI * 2,
    });
  }

  get count() {
    return this.units.length;
  }

  /** Nombre d'unités par espèce (mis en cache). */
  composition() {
    if (this._compVersion === this.version) return this._comp;
    const out = {};
    for (let i = 0; i < this.units.length; i++) {
      const k = this.units[i].species;
      out[k] = (out[k] || 0) + 1;
    }
    this._comp = out;
    this._compVersion = this.version;
    return out;
  }

  /** Nombre d'espèces distinctes (indicateur de diversité pour le « waouh »). */
  diversity() {
    return Object.keys(this.composition()).length;
  }

  add(count, species = 'panda') {
    const n = Math.max(0, Math.round(count));
    for (let i = 0; i < n; i++) this.push(species);
    this.layout();
    return n;
  }

  /**
   * Retire des unités. Les pandas partent en premier : on préserve la diversité
   * durement gagnée par l'apprivoisement (et donc l'intérêt visuel de l'armée).
   */
  remove(count) {
    let toRemove = Math.min(Math.round(count), this.units.length);
    if (toRemove <= 0) return 0;
    const removed = toRemove;

    const pandas = [];
    const others = [];
    for (let i = 0; i < this.units.length; i++) {
      (this.units[i].species === 'panda' ? pandas : others).push(i);
    }

    const doomed = new Set();
    for (let i = pandas.length - 1; i >= 0 && toRemove > 0; i--) {
      doomed.add(pandas[i]); toRemove--;
    }
    if (toRemove > 0) {
      // On garde si possible un représentant de chaque espèce apprivoisée.
      const byKind = {};
      others.forEach((idx) => {
        const k = this.units[idx].species;
        (byKind[k] = byKind[k] || []).push(idx);
      });
      const kinds = Object.keys(byKind);
      let guard = 0;
      while (toRemove > 0 && guard < 10000) {
        guard++;
        let any = false;
        for (const k of kinds) {
          const list = byKind[k];
          if (list.length > 1 && toRemove > 0) {
            doomed.add(list.pop()); toRemove--; any = true;
          }
        }
        if (!any) break;
      }
      for (const k of kinds) {
        const list = byKind[k];
        while (list.length && toRemove > 0) { doomed.add(list.pop()); toRemove--; }
      }
    }

    this.units = this.units.filter((_, i) => !doomed.has(i));
    this.layout();
    return removed;
  }

  multiply(factor) {
    const target = Math.max(0, Math.floor(this.count * factor));
    if (target > this.count) {
      // La multiplication clone la composition existante : l'armée reste diverse.
      const source = this.units.slice();
      const missing = target - this.count;
      for (let i = 0; i < missing; i++) {
        this.push(source[i % source.length].species);
      }
      this.layout();
      return missing;
    }
    return -this.remove(this.count - target);
  }

  setFormation(name, duration = 4200) {
    this.formation = name;
    this.formationTimer = duration;
    this.layout();
  }

  update(dt) {
    if (this.formationTimer > 0) {
      this.formationTimer -= dt * 1000;
      if (this.formationTimer <= 0 && this.formation !== 'blob') {
        this.formation = 'blob';
        this.layout();
      }
    }
  }

  /** Rayon d'encombrement : croît en racine du nombre (le poids du nombre). */
  get spread() {
    return this._spread;
  }

  /**
   * Malus de maniabilité : 1 = parfaitement agile, → 0.24 pour une armée immense.
   * C'est le cœur du Yin-Yang : le nombre coûte en contrôle.
   */
  agility(handlingBonus = 0) {
    const n = this.count;
    const raw = 1 / (1 + Math.pow(n / 55, 0.85));
    return Math.min(1, Math.max(0.24, raw * (1 + handlingBonus)));
  }

  /** Positions relatives (ox lateral, oz profondeur) selon la formation active. */
  layout() {
    this.touch();
    const n = this.count;
    // Coefficient calibré pour que la piste pleine largeur plafonne l'armée
    // autour de 800 unités, et un passage étroit autour de 300 : assez pour
    // que la masse se sente, pas assez pour transformer un couloir en mur.
    this._spread = 22 + 8 * Math.sqrt(Math.max(n - 1, 0));
    if (!n) return;
    const spread = this._spread;
    const units = this.units;

    switch (this.formation) {
      case 'line': {
        const rows = Math.max(1, Math.ceil(n / 26));
        const perRow = Math.ceil(n / rows);
        for (let i = 0; i < n; i++) {
          const row = i % rows;
          const idx = Math.floor(i / rows);
          const t = perRow > 1 ? idx / (perRow - 1) - 0.5 : 0;
          units[i].ox = t * spread * 2.4;
          units[i].oz = -row * 32;
        }
        break;
      }
      case 'wedge': {
        const half = Math.max(1, Math.ceil(n / 2) - 1);
        for (let i = 0; i < n; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          const rank = Math.floor(i / 2);
          const t = n > 1 ? rank / half : 0;
          units[i].ox = side * t * spread * 1.8;
          units[i].oz = -t * spread * 1.6;
        }
        break;
      }
      case 'circle': {
        const rings = Math.max(1, Math.ceil(n / 22));
        const perRing = Math.ceil(n / rings);
        for (let i = 0; i < n; i++) {
          const ring = i % rings;
          const idx = Math.floor(i / rings);
          const a = (idx / perRing) * Math.PI * 2;
          const r = spread * (0.55 + 0.45 * (ring + 1) / rings);
          units[i].ox = Math.cos(a) * r * 1.25;
          units[i].oz = Math.sin(a) * r * 0.9;
        }
        break;
      }
      default: {
        // Blob en phyllotaxie, dense et organique — et volontairement plus
        // profond que large : une troupe qui s'étale sur les côtés sort de la
        // piste, alors qu'une troupe qui s'allonge derrière le meneur tient.
        for (let i = 0; i < n; i++) {
          const r = spread * Math.sqrt((i + 0.5) / n);
          const a = i * GOLDEN;
          units[i].ox = Math.cos(a) * r * 0.92;
          units[i].oz = Math.sin(a) * r * 1.05;
        }
        break;
      }
    }
  }

  /**
   * Les unités hors piste sont perdues (§4.C). Renvoie le nombre d'unités
   * dont la position dépasse le bord, sans les retirer (la scène décide).
   * Estimation analytique au-delà de 120 unités : inutile de balayer 400 unités
   * chaque frame pour un compte approximatif.
   */
  countOutside(centerX, roadHalf) {
    const n = this.count;
    if (n === 0) return 0;
    if (n <= 120) {
      let out = 0;
      for (let i = 0; i < n; i++) {
        const x = centerX + this.units[i].ox;
        if (x < -roadHalf || x > roadHalf) out++;
      }
      return out;
    }
    // Le blob est une distribution radiale uniforme : on intègre la part
    // du disque qui dépasse chaque bord.
    const r = this._spread * 0.92;
    const left = this.overflowFraction(-roadHalf - centerX, r, true);
    const right = this.overflowFraction(roadHalf - centerX, r, false);
    return Math.round(n * Math.min(1, left + right));
  }

  overflowFraction(edge, radius, isLeft) {
    if (radius <= 0) return 0;
    const d = isLeft ? -edge : edge;      // distance du centre au bord
    if (d >= radius) return 0;
    if (d <= -radius) return 1;
    const t = d / radius;
    // Aire du segment circulaire au-delà de la corde, normalisée.
    return (Math.acos(t) - t * Math.sqrt(1 - t * t)) / Math.PI;
  }

  /** Bonus agrégé d'une stat, avec rendements décroissants et plafond global. */
  bonus(stat) {
    if (this._bonusVersion !== this.version) {
      this._bonuses = {};
      this._bonusVersion = this.version;
    }
    const cached = this._bonuses[stat];
    if (cached !== undefined) return cached;

    const comp = this.composition();
    let total = 0;
    for (const key in comp) {
      const sp = SPECIES[key];
      if (!sp || !sp.bonus || sp.bonus.stat !== stat) continue;
      total += sp.bonus.cap * (1 - Math.exp(-sp.bonus.per * comp[key]));
    }
    const cap = BONUS_CAPS[stat] != null ? BONUS_CAPS[stat] : 1;
    const val = Math.min(total, cap);
    this._bonuses[stat] = val;
    return val;
  }

  /**
   * Liste des unités à dessiner, déjà triée du fond vers l'avant.
   * Recalculée seulement quand l'armée change (et non 60 fois par seconde).
   */
  drawable(maxDrawn = this.maxDrawn) {
    if (this._drawVersion === this.version && this._drawMax === maxDrawn) {
      return this._drawable;
    }
    const n = this.count;
    let list;
    if (n <= maxDrawn) {
      list = this.units.slice();
    } else {
      // Échantillonnage régulier : on garde la silhouette et la diversité visible.
      const step = n / maxDrawn;
      list = [];
      for (let i = 0; i < maxDrawn; i++) list.push(this.units[Math.floor(i * step)]);
    }
    list.sort((a, b) => b.oz - a.oz);
    this._drawable = list;
    this._drawVersion = this.version;
    this._drawMax = maxDrawn;
    return list;
  }
}
