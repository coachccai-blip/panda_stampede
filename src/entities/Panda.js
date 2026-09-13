// Panda — le meneur. Ne gère que la latéralité : l'avancée est automatique
// (auto-runner, §5). Sa vitesse de virage dépend de la masse de l'armée.

import { clamp, damp } from '../core/perspective.js';

export class Panda {
  constructor(army) {
    this.army = army;
    this.x = 0;
    this.targetX = 0;
    this.vx = 0;
    this.bob = 0;
    this.lean = 0;
    this.invulnUntil = 0;
    this.now = 0;
  }

  reset() {
    this.x = 0;
    this.targetX = 0;
    this.vx = 0;
    this.lean = 0;
  }

  /** Déplacement au pas de voie (clavier). */
  nudge(dir, roadHalf, laneCount = 3) {
    const laneWidth = (roadHalf * 2) / laneCount;
    this.targetX = clamp(this.targetX + dir * laneWidth, -roadHalf * 0.92, roadHalf * 0.92);
  }

  /** Pointeur / glissement : visée directe. */
  aimAt(worldX, roadHalf) {
    this.targetX = clamp(worldX, -roadHalf * 0.98, roadHalf * 0.98);
  }

  update(dt, ctx) {
    this.now += dt * 1000;
    const agility = ctx.perfectHandling ? 1 : this.army.agility(ctx.handlingBonus);
    // λ élevé = virage sec ; une grosse armée traîne dans les virages.
    const lambda = 2.0 + 9.0 * agility;
    const prev = this.x;
    this.x = damp(this.x, this.targetX, lambda, dt);
    this.vx = dt > 0 ? (this.x - prev) / dt : 0;
    this.lean = damp(this.lean, clamp(this.vx / 900, -1, 1), 8, dt);
    this.bob += dt * (7 + ctx.speedRatio * 4);

    const limit = ctx.roadHalf * 0.98;
    if (this.x < -limit) { this.x = -limit; this.targetX = Math.max(this.targetX, -limit); }
    if (this.x > limit) { this.x = limit; this.targetX = Math.min(this.targetX, limit); }
  }
}
