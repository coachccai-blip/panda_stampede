// Boss — un général animal par biome (§10).
// Hybride : il faut du NOMBRE (dégâts proportionnels à l'armée) ET le BON STYLE
// (seul le style qui bat sa garde ouvre une brèche). Le vaincre en gardant
// l'harmonie haute = victoire « apprivoisée » → skin + ralliement du général.

import { matchup } from '../data/styles.js';
import { clamp, damp } from '../core/perspective.js';

export class Boss {
  constructor(def) {
    this.def = def;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.phases = def.phases;
    this.phaseIndex = 0;
    this.timeLeft = def.timer;
    this.x = 0;
    this.targetX = 0;
    this.z = 620;
    this.bob = 0;
    this.harmony = 0.35;
    this.attacks = [];
    this.attackTimer = def.attackEvery * 0.8;
    this.hitFlash = 0;
    this.breachFlash = 0;
    this.defeated = false;
    this.timedOut = false;
    this.wobble = 0;
  }

  get requiredStyle() {
    return this.phases[Math.min(this.phaseIndex, this.phases.length - 1)];
  }

  /** Part de vie restante dans la phase courante (barre segmentée). */
  get hpRatio() {
    return clamp(this.hp / this.maxHp, 0, 1);
  }

  get phaseRatio() {
    const per = this.maxHp / this.phases.length;
    const inPhase = this.hp - per * (this.phases.length - 1 - this.phaseIndex);
    return clamp(inPhase / per, 0, 1);
  }

  /**
   * @returns {{damage:number, unitsLost:number, phaseChanged:boolean,
   *            defeated:boolean, timedOut:boolean, hit:boolean, breach:boolean}}
   */
  update(dt, ctx) {
    const out = {
      damage: 0, unitsLost: 0, phaseChanged: false,
      defeated: false, timedOut: false, hit: false, breach: false,
    };
    if (this.defeated) return out;

    this.bob += dt * 3.4;
    this.wobble += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
    this.breachFlash = Math.max(0, this.breachFlash - dt * 2);

    // Déplacement latéral : il cherche à couper la route au joueur.
    if (this.wobble > 1.4) {
      this.wobble = 0;
      this.targetX = (Math.random() * 2 - 1) * ctx.roadHalf * 0.55;
    }
    this.x = damp(this.x, this.targetX, 1.6, dt);

    this.timeLeft -= dt * 1000;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      out.timedOut = true;
      this.timedOut = true;
      return out;
    }

    // --- brèche : le style qui bat sa garde ---
    const m = matchup(ctx.playerStyle, this.requiredStyle);
    let dps = 0;
    if (m === 1) {
      dps = ctx.armyCount * 2.4 * (1 + ctx.powerBonus) * ctx.abilityPower;
      out.breach = true;
      this.breachFlash = 1;
      this.harmony = clamp(this.harmony + dt * 0.11, 0, 1);
    } else if (m === 0) {
      dps = ctx.armyCount * 0.22 * (1 + ctx.powerBonus) * ctx.abilityPower;
    } else {
      // Mauvais style : sa garde renvoie les assauts.
      if (!ctx.shielded) {
        out.unitsLost += ctx.armyCount * dt * 0.05;
      }
      this.harmony = clamp(this.harmony - dt * 0.09, 0, 1);
    }

    if (dps > 0) {
      const dmg = dps * dt;
      this.hp -= dmg;
      out.damage = dmg;
      this.hitFlash = Math.min(1, this.hitFlash + dt * 4);
    }

    // --- changement de phase ---
    const perPhase = this.maxHp / this.phases.length;
    const wantedIndex = clamp(
      Math.floor((this.maxHp - this.hp) / perPhase), 0, this.phases.length - 1
    );
    if (wantedIndex !== this.phaseIndex) {
      this.phaseIndex = wantedIndex;
      out.phaseChanged = true;
      this.attackTimer = this.def.attackEvery * 0.6;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.defeated = true;
      out.defeated = true;
      return out;
    }

    // --- attaques à esquiver ---
    this.attackTimer -= dt * 1000;
    if (this.attackTimer <= 0) {
      this.attackTimer = this.def.attackEvery * (0.85 + Math.random() * 0.3);
      this.spawnAttack(ctx);
    }
    for (let i = this.attacks.length - 1; i >= 0; i--) {
      const a = this.attacks[i];
      a.z -= ctx.attackSpeed * dt;
      if (a.z <= 0 && !a.resolved) {
        a.resolved = true;
        const px = ctx.playerX;
        const half = ctx.armySpread * 0.8;
        const lo = a.f0 * ctx.roadHalf;
        const hi = a.f1 * ctx.roadHalf;
        if (px + half > lo && px - half < hi) {
          if (!ctx.shielded) {
            out.unitsLost += Math.max(1, ctx.armyCount * 0.14);
            out.hit = true;
            this.harmony = clamp(this.harmony - 0.18, 0, 1);
          }
        } else {
          this.harmony = clamp(this.harmony + 0.05, 0, 1);
        }
      }
      if (a.z < -260) this.attacks.splice(i, 1);
    }

    return out;
  }

  spawnAttack() {
    // Bande dangereuse couvrant ~55 % de la piste : il reste toujours une issue.
    const width = 0.55 + Math.random() * 0.25;
    const f0 = -1 + Math.random() * (2 - width * 2) + (Math.random() < 0.5 ? 0 : 0);
    const start = clamp(f0, -1, 1 - width);
    this.attacks.push({
      z: this.z,
      f0: start,
      f1: start + width,
      resolved: false,
      born: performance.now(),
    });
  }

  /** Victoire pacifique si l'harmonie est haute au moment du K.O. */
  get tamedVictory() {
    return this.harmony >= 0.7;
  }
}
