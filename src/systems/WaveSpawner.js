// WaveSpawner — génère la piste d'un biome à partir des données (§15).
// Les positions latérales sont exprimées en fractions de la demi-largeur de
// piste (-1 → bord gauche, +1 → bord droit) : les portes restent jouables même
// dans les passages qui rétrécissent.

import { TrackProfile } from '../core/perspective.js';

const GATE_OPS = [
  { op: 'add', value: 3, weight: 4 },
  { op: 'add', value: 5, weight: 4 },
  { op: 'add', value: 8, weight: 3 },
  { op: 'mul', value: 2, weight: 2 },
  { op: 'sub', value: 4, weight: 3 },
  { op: 'div', value: 2, weight: 2 },
];

const SHAPES = ['line', 'wedge', 'circle'];

function pickOp(rng, favourGood) {
  const weights = GATE_OPS.map((o) => {
    const good = o.op === 'add' || o.op === 'mul';
    return o.weight * (good === favourGood ? 2 : 1);
  });
  return GATE_OPS[rng.weighted(weights)];
}

/** Une rangée de portes : 2 ou 3 ouvertures côte à côte, au moins une bonne. */
function makeGateRow(rng, z, doorCount) {
  const doors = [];
  const goodIndex = rng.int(0, doorCount - 1);
  for (let i = 0; i < doorCount; i++) {
    const f0 = -1 + (2 * i) / doorCount;
    const f1 = -1 + (2 * (i + 1)) / doorCount;
    const def = pickOp(rng, i === goodIndex);
    doors.push({ f0, f1, op: def.op, value: def.value });
  }
  return { type: 'gate', z, doors, done: false };
}

/**
 * @param {object} biome définition de biome
 * @param {Rng} rng générateur déterministe
 * @param {{difficulty?: number}} [opts] multiplicateur d'effectifs ennemis
 *        (le mode Infini le fait monter à chaque étape)
 */
export function buildLevel(biome, rng, opts = {}) {
  const difficulty = opts.difficulty || 1;
  const events = [];
  const profile = new TrackProfile(biome.roadHalf);
  const length = biome.length;
  const introSpace = 1400;           // de l'air avant la première décision

  // --- portes de croissance, en slalom ---
  let z = introSpace;
  while (z < length - 1800) {
    const doorCount = rng.chance(0.35) ? 3 : 2;
    events.push(makeGateRow(rng, z, doorCount));
    z += biome.gateEvery * rng.range(0.82, 1.2);
  }

  // --- jetons de style, semés en continu ---
  const styles = biome.dominantStyle
    ? [biome.dominantStyle, ...uniq(biome.enemyStyles)]
    : ['bamboo', 'fire', 'water', 'wind'];
  z = introSpace * 0.55;
  while (z < length - 900) {
    const st = rng.chance(0.55) && biome.dominantStyle
      ? rng.pick(counterStyles(biome.enemyStyles))
      : rng.pick(styles);
    const f = rng.range(-0.75, 0.75);
    const cluster = rng.chance(0.3) ? 3 : 1;
    for (let c = 0; c < cluster; c++) {
      events.push({
        type: 'token', z: z + c * 120, f, style: st, done: false,
        phase: rng.range(0, Math.PI * 2),
      });
    }
    z += biome.tokenEvery * rng.range(0.75, 1.3);
  }

  // --- rencontres : le vrai dilemme combattre / apprivoiser ---
  z = introSpace + biome.encounterEvery * 0.6;
  let enc = 0;
  while (z < length - 2200) {
    const progress = z / length;
    const speciesIdx = rng.int(0, biome.enemyPool.length - 1);
    const species = biome.enemyPool[speciesIdx];
    const style = biome.enemyStyles[speciesIdx] || biome.enemyStyles[0];
    const base = (biome.enemyBase + biome.enemyGrowth * enc) * difficulty;
    const count = Math.max(3, Math.round(base * (1 + progress * 1.5) * rng.range(0.85, 1.15)));
    const fightLeft = rng.chance(0.5);
    events.push({
      type: 'encounter',
      z,
      species,
      style,
      count,
      fightLeft,
      done: false,
      previewed: false,
      units: makeEnemyUnits(rng, count),
    });
    enc++;
    z += biome.encounterEvery * rng.range(0.9, 1.15);
  }

  // --- défis de formation (§6) : un pochoir, puis la porte bonus ---
  z = introSpace + 900;
  let formationId = 0;
  while (z < length - 2600) {
    if (rng.chance(biome.formationChance)) {
      const shape = rng.pick(SHAPES);
      const pads = shuffled(rng, SHAPES).map((s, i) => ({
        shape: s,
        f0: -1 + (2 * i) / 3,
        f1: -1 + (2 * (i + 1)) / 3,
      }));
      const gateZ = z + 820;
      const pairId = ++formationId;
      events.push({ type: 'formation', z, pads, shape, gateZ, pairId, done: false });
      events.push({ type: 'bonusGate', z: gateZ, shape, mult: 2, pairId, done: false });
    }
    z += 2600 * rng.range(0.85, 1.25);
  }

  // --- rétrécissements de piste ---
  z = introSpace + 1200;
  while (z < length - 1500) {
    if (rng.chance(biome.narrowChance)) {
      const len = rng.range(900, 1800);
      profile.addNarrow(z, z + len, biome.roadHalf * rng.range(0.48, 0.68));
      events.push({ type: 'narrowMark', z, zEnd: z + len, done: false });
      z += len;
    }
    z += 1500 * rng.range(0.8, 1.3);
  }

  // --- obstacles d'environnement (lave, rochers, racines) ---
  if (biome.weather === 'embers' || biome.key === 'wolf_valley' || biome.key === 'celestial_temple') {
    z = introSpace + 1600;
    while (z < length - 1600) {
      const f = rng.range(-0.7, 0.7);
      events.push({ type: 'obstacle', z, f, width: rng.range(0.28, 0.42), done: false });
      z += rng.range(1300, 2400);
    }
  }

  events.push({ type: 'bossGate', z: length, done: false });

  // Zone de respiration autour des rencontres : sans ça, une porte +5 se
  // superpose visuellement aux portes ⚔/🤝 et le joueur ne sait plus ce qu'il
  // franchit. Le dilemme a besoin d'être seul à l'écran au moment de décider.
  const encounters = events.filter((e) => e.type === 'encounter');
  const CLEAR_BEFORE = 900;
  const CLEAR_AFTER = 520;
  const inClearZone = (e) =>
    encounters.some((enc) => e.z > enc.z - CLEAR_BEFORE && e.z < enc.z + CLEAR_AFTER);

  // Un pochoir de formation et sa porte bonus forment un couple : si l'un tombe
  // dans une zone de respiration, on retire les deux (sinon le joueur adopte
  // une formation qui ne mène à rien).
  const brokenPairs = new Set();
  events.forEach((e) => {
    if (e.pairId && inClearZone(e)) brokenPairs.add(e.pairId);
  });

  const cleared = events.filter((e) => {
    if (e.pairId) return !brokenPairs.has(e.pairId);
    if (e.type === 'encounter' || e.type === 'token' || e.type === 'narrowMark'
      || e.type === 'bossGate') return true;
    return !inClearZone(e);
  });

  cleared.sort((a, b) => a.z - b.z);
  return { events: cleared, profile, length, biome };
}

function makeEnemyUnits(rng, count) {
  const drawn = Math.min(count, 44);
  const units = [];
  for (let i = 0; i < drawn; i++) {
    const r = Math.sqrt((i + 0.5) / drawn);
    const a = i * 2.39996323;
    units.push({
      ox: Math.cos(a) * r * (34 + 10 * Math.sqrt(count)),
      oz: Math.sin(a) * r * (26 + 8 * Math.sqrt(count)),
      phase: rng.range(0, Math.PI * 2),
    });
  }
  return units;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

/** Styles qui battent ceux des ennemis du biome : les jetons utiles. */
function counterStyles(enemyStyles) {
  const counter = { fire: 'bamboo', wind: 'fire', water: 'wind', bamboo: 'water' };
  const out = uniq(enemyStyles.map((s) => counter[s]).filter(Boolean));
  return out.length ? out : ['bamboo'];
}

function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

export { SHAPES };
