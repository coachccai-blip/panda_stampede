// WaveSpawner — génère la piste d'un biome à partir des données (§15).
// Les positions latérales sont exprimées en fractions de la demi-largeur de
// piste (-1 → bord gauche, +1 → bord droit) : les portes restent jouables même
// dans les passages qui rétrécissent.

import { TrackProfile } from '../core/perspective.js';

// Les portes doivent amener une armée de plusieurs centaines d'unités en fin de
// biome : c'est la condition pour que le fantasme de foule ET le plafond
// Yin-Yang (la largeur de piste qui limite la masse) se déclenchent réellement.
const GATE_OPS = [
  { op: 'add', value: 5, weight: 4 },
  { op: 'add', value: 9, weight: 4 },
  { op: 'add', value: 14, weight: 3 },
  { op: 'mul', value: 2, weight: 3 },
  { op: 'sub', value: 6, weight: 3 },
  { op: 'div', value: 2, weight: 2 },
];

const SHAPES = ['line', 'wedge', 'circle'];

// Marge dégagée autour d'une rencontre, en unités de piste.
const CLEAR_BEFORE = 780;
const CLEAR_AFTER = 420;

const GOOD_OPS = GATE_OPS.filter((o) => o.op === 'add' || o.op === 'mul');

function pickOp(rng, forceGood) {
  // Une rangée contient TOUJOURS au moins une porte bénéfique : sans cette
  // garantie, un slalom pouvait n'offrir que ÷2 et −6, ce qui condamnait une
  // petite armée sans que le joueur ait commis la moindre erreur.
  const pool = forceGood ? GOOD_OPS : GATE_OPS;
  return pool[rng.weighted(pool.map((o) => o.weight))];
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
  const introSpace = 950;            // de l'air avant la première décision

  // --- jetons de style, semés en continu ---
  const styles = biome.dominantStyle
    ? [biome.dominantStyle, ...uniq(biome.enemyStyles)]
    : ['bamboo', 'fire', 'water', 'wind'];
  let z = introSpace * 0.55;
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
      baseCount: count,
      fightLeft,
      done: false,
      previewed: false,
      units: makeEnemyUnits(rng, count),
    });
    enc++;
    z += biome.encounterEvery * rng.range(0.9, 1.15);
  }

  // --- zones de respiration autour des rencontres ---
  // Le dilemme doit être seul à l'écran au moment de décider. Mais supprimer
  // les portes qui tombent là revenait à effacer jusqu'à 80 % de la croissance
  // dans les biomes resserrés : on les DÉCALE donc au lieu de les retirer, en
  // sautant par-dessus la zone. La cadence est préservée, la lisibilité aussi.
  const zones = events
    .filter((e) => e.type === 'encounter')
    .map((e) => ({ start: e.z - CLEAR_BEFORE, end: e.z + CLEAR_AFTER }));

  const skipZones = (pos) => {
    let p = pos;
    for (let i = 0; i < zones.length; i++) {
      if (p > zones[i].start && p < zones[i].end) { p = zones[i].end; i = -1; }
    }
    return p;
  };

  // --- portes de croissance, en slalom ---
  z = introSpace;
  while (z < length - 1500) {
    z = skipZones(z);
    if (z >= length - 1500) break;
    events.push(makeGateRow(rng, z, rng.chance(0.35) ? 3 : 2));
    z += biome.gateEvery * rng.range(0.82, 1.2);
  }

  // --- défis de formation (§6) : un pochoir, puis la porte bonus ---
  z = introSpace + 900;
  let formationId = 0;
  while (z < length - 2600) {
    z = skipZones(z);
    if (z >= length - 2600) break;
    if (rng.chance(biome.formationChance) && skipZones(z + 820) === z + 820) {
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
      profile.addNarrow(z, z + len, biome.roadHalf * rng.range(0.62, 0.80));
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

  // Seuls les obstacles d'environnement restent filtrés : un rocher planté dans
  // une zone de décision n'apporte rien qu'on ne puisse déplacer ailleurs.
  const cleared = events.filter(
    (e) => e.type !== 'obstacle' || skipZones(e.z) === e.z
  );

  cleared.sort((a, b) => a.z - b.z);
  return { events: cleared, profile, length, biome };
}

export function makeEnemyUnits(rng, count) {
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
