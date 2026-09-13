// StyleManager — style actif, capacité active et fenêtre de "switch à la volée".

import { STYLES, styleOf } from '../data/styles.js';

export class StyleManager {
  constructor(initial = 'bamboo', cooldownBonus = 0) {
    this.current = initial;
    this.previous = initial;
    this.changedAt = -9999;
    this.cooldownBonus = cooldownBonus;   // 0 → 0.4, réduit la recharge
    this.abilityUntil = 0;
    this.abilityReadyAt = 0;
    this.abilityStyle = null;
    this.now = 0;
  }

  update(dt) {
    this.now += dt * 1000;
  }

  set(styleKey) {
    if (!STYLES[styleKey] || styleKey === this.current) return false;
    this.previous = this.current;
    this.current = styleKey;
    this.changedAt = this.now;
    return true;
  }

  cycle(dir = 1) {
    const keys = Object.keys(STYLES);
    const i = keys.indexOf(this.current);
    return this.set(keys[(i + dir + keys.length) % keys.length]);
  }

  get style() {
    return styleOf(this.current);
  }

  get abilityActive() {
    return this.now < this.abilityUntil;
  }

  get abilityReady() {
    return this.now >= this.abilityReadyAt && !this.abilityActive;
  }

  /** 0 → 1, part de recharge écoulée (pour la jauge du HUD). */
  cooldownProgress() {
    if (this.abilityActive) return 1;
    const ab = this.style.ability;
    const cd = ab.cooldown * (1 - this.cooldownBonus);
    const remaining = this.abilityReadyAt - this.now;
    if (remaining <= 0) return 1;
    return Math.max(0, 1 - remaining / cd);
  }

  /** Part restante de la capacité en cours (pour l'aura du joueur). */
  activeProgress() {
    if (!this.abilityActive) return 0;
    const ab = STYLES[this.abilityStyle || this.current].ability;
    return Math.max(0, (this.abilityUntil - this.now) / ab.duration);
  }

  trigger() {
    if (!this.abilityReady) return null;
    const ab = this.style.ability;
    this.abilityStyle = this.current;
    this.abilityUntil = this.now + ab.duration;
    this.abilityReadyAt = this.abilityUntil + ab.cooldown * (1 - this.cooldownBonus);
    return { style: this.current, ability: ab };
  }

  /** Effets passifs en cours, lus par RunScene à chaque frame. */
  effects() {
    if (!this.abilityActive) {
      return { shield: false, power: 1, perfectHandling: false, speed: 1, harvest: 1 };
    }
    switch (this.abilityStyle) {
      case 'bamboo': return { shield: true, power: 1, perfectHandling: false, speed: 1, harvest: 1 };
      case 'fire': return { shield: false, power: 2, perfectHandling: false, speed: 1.08, harvest: 1 };
      case 'water': return { shield: true, power: 1, perfectHandling: true, speed: 1, harvest: 1 };
      case 'wind': return { shield: false, power: 1, perfectHandling: false, speed: 1.6, harvest: 2 };
      default: return { shield: false, power: 1, perfectHandling: false, speed: 1, harvest: 1 };
    }
  }
}
