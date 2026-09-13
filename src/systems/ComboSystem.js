// ComboSystem — récompense l'enchaînement de décisions justes (bon style,
// apprivoisement réussi, formation parfaite) par un multiplicateur de bambou.
// Il mesure aussi l'« harmonie » : la part de voie pacifique d'une run.

const TIERS = [
  { at: 0, mult: 1, label: '' },
  { at: 2, mult: 1.25, label: 'ENCHAÎNÉ' },
  { at: 4, mult: 1.5, label: 'FLUIDE' },
  { at: 6, mult: 2, label: 'MAÎTRE' },
  { at: 9, mult: 3, label: 'ÉVEILLÉ' },
];

export class ComboSystem {
  constructor() {
    this.chain = 0;
    this.best = 0;
    this.timer = 0;
    this.window = 9000;      // ms avant rupture de la chaîne
    this.tamed = 0;
    this.fought = 0;
    this.tamedUnits = 0;
    this.perfectStyles = 0;
    this.formations = 0;
  }

  update(dt) {
    if (this.chain > 0) {
      this.timer -= dt * 1000;
      if (this.timer <= 0) this.chain = 0;
    }
  }

  /** @param {'tame'|'fight'|'formation'} kind */
  success(kind, opts = {}) {
    this.chain++;
    this.best = Math.max(this.best, this.chain);
    this.timer = this.window;
    if (kind === 'tame') {
      this.tamed++;
      this.tamedUnits += opts.units || 0;
    } else if (kind === 'fight') {
      this.fought++;
    } else if (kind === 'formation') {
      this.formations++;
    }
    if (opts.perfectStyle) this.perfectStyles++;
    return this.tier;
  }

  fail(kind) {
    this.chain = 0;
    this.timer = 0;
    if (kind === 'fight') this.fought++;
  }

  get tier() {
    let t = TIERS[0];
    for (let i = 0; i < TIERS.length; i++) if (this.chain >= TIERS[i].at) t = TIERS[i];
    return t;
  }

  get multiplier() {
    return this.tier.mult;
  }

  /** 0 → 1 : part des rencontres résolues par l'apprivoisement. */
  get harmony() {
    const total = this.tamed + this.fought;
    return total === 0 ? 0 : this.tamed / total;
  }

  /** Part restante de la fenêtre de combo (jauge du HUD). */
  get windowProgress() {
    return this.chain > 0 ? Math.max(0, this.timer / this.window) : 0;
  }
}
