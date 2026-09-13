// FormationChecker — mémorise la formation prise sur un pochoir et vérifie
// qu'elle tient encore au moment de franchir la porte bonus (§6).

export class FormationChecker {
  constructor() {
    this.held = null;        // forme adoptée
    this.heldUntil = 0;      // distance absolue au-delà de laquelle elle se dissout
    this.now = 0;
  }

  setDistance(distance) {
    this.now = distance;
  }

  adopt(shape, holdDistance = 2000) {
    this.held = shape;
    this.heldUntil = this.now + holdDistance;
    return shape;
  }

  get active() {
    return this.held && this.now < this.heldUntil;
  }

  /** Part restante de la formation (jauge du HUD). */
  progress(holdDistance = 2000) {
    if (!this.active) return 0;
    return Math.max(0, (this.heldUntil - this.now) / holdDistance);
  }

  /** @returns {'perfect'|'wrong'|'none'} */
  check(requiredShape) {
    if (!this.active) return 'none';
    return this.held === requiredShape ? 'perfect' : 'wrong';
  }

  clear() {
    this.held = null;
    this.heldUntil = 0;
  }
}

export const SHAPE_LABELS = {
  line: 'LIGNE',
  wedge: 'COIN',
  circle: 'CERCLE',
};

export const SHAPE_ICONS = {
  line: '▭',
  wedge: '◤',
  circle: '◯',
};
