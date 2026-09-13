// ChiSystem — « Éveil » (mécanique maison, au-delà du brief).
//
// Le brief valorise la voie pacifique par des cosmétiques seulement. Le Chi lui
// donne une récompense ACTIVE : apprivoiser remplit une jauge qui déclenche
// l'Éveil — quelques secondes où l'armée maîtrise les quatre styles à la fois.
// Résultat : le joueur pacifique n'est plus seulement « joli », il est puissant,
// et il doit décider quand dépenser sa jauge (rencontre difficile ? boss ?).

const BASE_COST = 100;
const DURATION = 7000;

export const CHI_GAINS = {
  tame: 26,          // apprivoisement complet
  tamePartial: 11,
  perfectFight: 9,   // combat gagné avec le style dominant
  fight: 3,
  formation: 14,
  token: 1.5,
  bossBreach: 6,     // par seconde de brèche ouverte sur un boss
};

export class ChiSystem {
  constructor(costReduction = 0) {
    this.cost = Math.max(40, Math.round(BASE_COST * (1 - costReduction)));
    this.value = 0;
    this.activeUntil = 0;
    this.now = 0;
    this.justFilled = false;
    this.totalSpent = 0;
  }

  update(dt) {
    this.now += dt * 1000;
  }

  gain(amount) {
    if (this.active) return;
    const before = this.value;
    this.value = Math.min(this.cost, this.value + amount);
    if (before < this.cost && this.value >= this.cost) this.justFilled = true;
  }

  consumeFilledFlag() {
    const v = this.justFilled;
    this.justFilled = false;
    return v;
  }

  get ratio() {
    return Math.min(1, this.value / this.cost);
  }

  get ready() {
    return this.value >= this.cost && !this.active;
  }

  get active() {
    return this.now < this.activeUntil;
  }

  /** Part restante de l'Éveil (0 → 1) pour l'aura et le HUD. */
  get activeRatio() {
    if (!this.active) return 0;
    return (this.activeUntil - this.now) / DURATION;
  }

  trigger() {
    if (!this.ready) return false;
    this.value = 0;
    this.activeUntil = this.now + DURATION;
    this.totalSpent++;
    return true;
  }

  /**
   * Pendant l'Éveil : tous les styles comptent comme dominants, l'apprivoisement
   * ne peut plus échouer et l'armée ne perd plus d'unités.
   */
  effects() {
    return this.active
      ? { universalStyle: true, guaranteedTame: true, noLoss: true }
      : { universalStyle: false, guaranteedTame: false, noLoss: false };
  }
}

export { DURATION as CHI_DURATION, BASE_COST as CHI_BASE_COST };
