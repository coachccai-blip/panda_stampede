// EnemyGroup — formules de résolution des rencontres (§7).
// Tout est exposé en fonctions pures : le HUD peut ainsi AFFICHER le taux de
// réussite avant le choix, ce qui rend le dilemme lisible sans tutoriel (§17).

import { matchup, combatMultiplier } from '../data/styles.js';
import { clamp } from '../core/perspective.js';

/** Matchup effectif : l'Éveil (Chi) fait compter tous les styles comme dominants. */
export function effectiveMatchup(ctx) {
  if (ctx.universalStyle) return 1;
  return matchup(ctx.playerStyle, ctx.enemyStyle);
}

/**
 * Coût en unités d'un combat frontal.
 * Le bon style divise le coût : c'est là que le timing des jetons paie.
 */
export function fightCost(ctx) {
  const base = ctx.universalStyle ? 1.6 : combatMultiplier(ctx.playerStyle, ctx.enemyStyle);
  const mult = base * (1 + (ctx.powerBonus || 0)) * (ctx.abilityPower || 1);
  return Math.max(1, Math.ceil(ctx.enemyCount / mult));
}

export function previewFight(ctx) {
  const cost = fightCost(ctx);
  const win = ctx.armyCount > cost;
  let losses;
  if (win) {
    losses = cost;
  } else {
    losses = Math.min(
      ctx.armyCount,
      Math.max(1, Math.ceil(
        Math.min((cost - ctx.armyCount) * 0.8, ctx.armyCount * 0.7) * (1 - (ctx.resistBonus || 0))
      ))
    );
  }
  if (ctx.noLoss) losses = win ? 0 : 0;      // Éveil : aucune perte
  return { win: win || !!ctx.noLoss, cost, losses, remaining: ctx.armyCount - losses };
}

export function resolveFight(ctx) {
  const preview = previewFight(ctx);
  return {
    kind: 'fight',
    win: preview.win,
    losses: preview.losses,
    remaining: preview.remaining,
    // Combattre ne rapporte que du nombre brut… et du bambou.
    bamboo: preview.win ? Math.round(ctx.enemyCount * 2.2) : Math.round(ctx.enemyCount * 0.4),
    perfectStyle: effectiveMatchup(ctx) === 1,
  };
}

/**
 * Taux de réussite de l'apprivoisement :
 * 50 % + 20 % (bon style) − 10 % par tranche de 10 unités de désavantage.
 */
export function tameChance(ctx) {
  if (ctx.guaranteedTame) return 1;
  const m = effectiveMatchup(ctx);
  let p = 0.5;
  if (m === 1) p += 0.20;
  else if (m === -1) p -= 0.15;
  const deficit = Math.max(0, ctx.enemyCount - ctx.armyCount);
  p -= 0.10 * Math.floor(deficit / 10);
  p += ctx.tameBonus || 0;
  return clamp(p, 0.05, 0.95);
}

export function previewTame(ctx) {
  const p = tameChance(ctx);
  return {
    chance: p,
    fullGain: ctx.enemyCount,
    partialGain: Math.max(1, Math.floor(ctx.enemyCount * p * 0.5)),
    styleMatch: effectiveMatchup(ctx),
  };
}

export function resolveTame(ctx, roll) {
  const pre = previewTame(ctx);
  const success = roll < pre.chance;
  if (success) {
    return {
      kind: 'tame',
      success: true,
      partial: false,
      converted: pre.fullGain,
      losses: 0,
      bamboo: Math.round(ctx.enemyCount * 1.1),
      perfectStyle: pre.styleMatch === 1,
    };
  }
  // Échec = réussite partielle : on convertit une fraction, on perd un peu.
  const rawLoss = Math.max(1, Math.ceil(ctx.enemyCount * 0.12 * (1 - (ctx.resistBonus || 0))));
  const losses = ctx.noLoss ? 0 : Math.min(rawLoss, Math.max(0, ctx.armyCount - 1));
  return {
    kind: 'tame',
    success: false,
    partial: true,
    converted: pre.partialGain,
    losses,
    bamboo: Math.round(ctx.enemyCount * 0.5),
    perfectStyle: false,
  };
}
