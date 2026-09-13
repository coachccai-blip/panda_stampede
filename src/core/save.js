// Sauvegarde méta (localStorage). Toujours tolérante : si le stockage est
// indisponible (mode privé, cookies bloqués), la partie tourne en mémoire.

import { UPGRADES, CODEX_BONUSES } from '../data/upgrades.js';
import { BIOMES } from '../data/biomes.js';
import { TAMEABLE } from '../data/enemies.js';

const KEY = 'panda_stampede_save_v1';

function defaults() {
  const upgrades = {};
  UPGRADES.forEach((u) => { upgrades[u.key] = 0; });
  return {
    bamboo: 0,
    totalBamboo: 0,
    upgrades,
    codex: {},           // { boar: 12, wolf: 3, ... } nombre d'unités apprivoisées
    skins: { default: true },
    skin: 'default',
    companions: {},      // { wolf: true }
    activeCompanion: null,
    biomesUnlocked: 1,
    bestArmy: 0,
    bestScore: 0,
    runs: 0,
    tamedTotal: 0,
    foughtTotal: 0,
    bossesTamed: {},
    seenTutorial: false,
    muted: false,
    // --- réglages ---
    quality: 'auto',        // 'auto' | 'high' | 'low'
    slowmo: true,           // Instant de Sagesse
    shake: true,
    // --- modes & records ---
    bests: {},              // { [biomeKey]: { score, army, tamed } }
    endlessUnlocked: false,
    endlessBest: 0,
    dailyDate: null,
    dailyScore: 0,
    dailyBestEver: 0,
    lastMode: 'story',
  };
}

let state = defaults();
let storageOk = true;

export function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = Object.assign(defaults(), parsed);
      state.upgrades = Object.assign(defaults().upgrades, parsed.upgrades || {});
      state.skins = Object.assign({ default: true }, parsed.skins || {});
      state.codex = parsed.codex || {};
      state.companions = parsed.companions || {};
      state.bossesTamed = parsed.bossesTamed || {};
      state.bests = parsed.bests || {};
    }
  } catch (e) {
    storageOk = false;
    console.warn('[save] stockage indisponible, progression non persistée.', e);
  }
  return state;
}

export function save() {
  if (!storageOk) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    storageOk = false;
    console.warn('[save] écriture impossible.', e);
  }
}

export function get() {
  return state;
}

export function reset() {
  state = defaults();
  save();
  return state;
}

export function addBamboo(amount) {
  const a = Math.max(0, Math.round(amount));
  state.bamboo += a;
  state.totalBamboo += a;
  save();
}

export function spendBamboo(amount) {
  if (state.bamboo < amount) return false;
  state.bamboo -= amount;
  save();
  return true;
}

export function upgradeLevel(key) {
  return state.upgrades[key] || 0;
}

/** Valeur d'effet cumulée d'une amélioration du Dojo. */
export function upgradeEffect(key) {
  const def = UPGRADES.find((u) => u.key === key);
  if (!def) return 0;
  return def.effect(upgradeLevel(key));
}

export function buyUpgrade(key) {
  const def = UPGRADES.find((u) => u.key === key);
  if (!def) return false;
  const lvl = upgradeLevel(key);
  if (lvl >= def.max) return false;
  const cost = def.cost(lvl);
  if (!spendBamboo(cost)) return false;
  state.upgrades[key] = lvl + 1;
  save();
  return true;
}

export function recordTamed(speciesKey, count) {
  if (!speciesKey || speciesKey === 'panda') return false;
  const wasNew = !state.codex[speciesKey];
  state.codex[speciesKey] = (state.codex[speciesKey] || 0) + count;
  state.tamedTotal += count;
  save();
  return wasNew;
}

export function codexCount() {
  return TAMEABLE.filter((k) => state.codex[k]).length;
}

/** Bonus passifs débloqués par la complétion du codex. */
export function codexBonuses() {
  const n = codexCount();
  const out = { harvest: 0, tame: 0, power: 0 };
  CODEX_BONUSES.forEach((b) => { if (n >= b.at) out[b.stat] += b.value; });
  return out;
}

export function unlockSkin(key) {
  if (state.skins[key]) return false;
  state.skins[key] = true;
  save();
  return true;
}

export function setSkin(key) {
  if (!state.skins[key]) return false;
  state.skin = key;
  save();
  return true;
}

export function unlockBiome(index) {
  if (index + 1 > state.biomesUnlocked && index + 1 <= BIOMES.length) {
    state.biomesUnlocked = index + 1;
    save();
    return true;
  }
  return false;
}

export function setMuted(v) {
  state.muted = !!v;
  save();
}

export function finishRun(summary) {
  state.runs += 1;
  state.bestArmy = Math.max(state.bestArmy, summary.army || 0);
  state.bestScore = Math.max(state.bestScore, summary.score || 0);
  state.foughtTotal += summary.fought || 0;

  // Record par biome : sert de « fantôme » à battre sur la barre de progression.
  if (summary.biomeKey) {
    const prev = state.bests[summary.biomeKey] || { score: 0, army: 0, tamed: 0, progress: 0 };
    state.bests[summary.biomeKey] = {
      score: Math.max(prev.score, summary.score || 0),
      army: Math.max(prev.army, summary.bestArmy || 0),
      tamed: Math.max(prev.tamed, summary.tamedUnits || 0),
      progress: Math.max(prev.progress || 0, summary.progress || 0),
    };
  }
  if (summary.mode === 'endless') {
    state.endlessBest = Math.max(state.endlessBest, summary.score || 0);
  }
  if (summary.mode === 'daily') {
    const today = todayKey();
    if (state.dailyDate !== today) { state.dailyDate = today; state.dailyScore = 0; }
    state.dailyScore = Math.max(state.dailyScore, summary.score || 0);
    state.dailyBestEver = Math.max(state.dailyBestEver, summary.score || 0);
  }
  save();
}

export function bestFor(biomeKey) {
  return state.bests[biomeKey] || null;
}

export function setSetting(key, value) {
  state[key] = value;
  save();
}

/** Graine du jour : identique pour tout le monde, change à minuit local. */
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dailySeed() {
  const k = todayKey();
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function unlockEndless() {
  if (state.endlessUnlocked) return false;
  state.endlessUnlocked = true;
  save();
  return true;
}
