// Gate — portes de croissance (§6). Une porte ne connaît que son opération ;
// c'est ArmyManager qui encaisse le résultat.

export const GATE_COLORS = {
  add: 0x22c55e,
  mul: 0x38bdf8,
  sub: 0xef4444,
  div: 0xf97316,
};

export function gateLabel(door, multiplier = 1) {
  const v = door.value * (door.op === 'add' ? multiplier : 1);
  switch (door.op) {
    case 'add': return `+${v}`;
    case 'sub': return `−${door.value}`;
    case 'mul': return `×${door.value * multiplier}`;
    case 'div': return `÷${door.value}`;
    default: return '?';
  }
}

export function gateIsGood(door) {
  return door.op === 'add' || door.op === 'mul';
}

export function gateColor(door) {
  return GATE_COLORS[door.op] || 0x94a3b8;
}

/**
 * Applique une porte à l'armée.
 * @param {ArmyManager} army
 * @param {object} door
 * @param {number} multiplier bonus de formation (1 ou 2)
 * @returns {{delta:number, label:string, good:boolean}}
 */
export function applyGate(army, door, multiplier = 1) {
  const before = army.count;
  switch (door.op) {
    case 'add':
      army.add(door.value * multiplier, 'panda');
      break;
    case 'mul':
      army.multiply(door.value * multiplier);
      break;
    case 'sub':
      army.remove(door.value);
      break;
    case 'div':
      army.multiply(1 / door.value);
      break;
    default:
      break;
  }
  return {
    delta: army.count - before,
    label: gateLabel(door, multiplier),
    good: gateIsGood(door),
  };
}
