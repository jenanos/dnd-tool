import type { DieResult, GwfMode, RollMode } from './types';

/** Returns an integer in [1, sides]. Injected everywhere so tests can script outcomes. */
export type Rng = (sides: number) => number;

export const cryptoRng: Rng = (sides) => {
  // Rejection sampling avoids modulo bias.
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);
  return (n % sides) + 1;
};

/** Deterministic RNG for tests: yields the given faces in order and fails loudly when misused. */
export function scriptedRng(faces: number[]): Rng & { remaining: () => number } {
  const queue = [...faces];
  const rng = ((sides: number) => {
    const face = queue.shift();
    if (face === undefined) throw new Error(`scriptedRng exhausted (wanted a d${sides})`);
    if (face < 1 || face > sides) throw new Error(`scriptedRng: ${face} is not a valid d${sides} face`);
    return face;
  }) as Rng & { remaining: () => number };
  rng.remaining = () => queue.length;
  return rng;
}

/**
 * Rolls one damage die, applying Great Weapon Fighting when eligible.
 * 2024: a 1 or 2 counts as 3. 2014: a 1 or 2 is rerolled once and the new roll stands.
 */
export function rollDamageDie(sides: number, rng: Rng, gwf?: GwfMode): DieResult {
  const first = rng(sides);
  if (!gwf || first > 2) return { sides, rolls: [first], value: first };
  if (gwf === '2024') return { sides, rolls: [first], value: 3, gwf };
  const reroll = rng(sides);
  return { sides, rolls: [first, reroll], value: reroll, gwf };
}

export function rollD20(mode: RollMode, rng: Rng): { rolls: number[]; natural: number } {
  if (mode === 'normal') {
    const r = rng(20);
    return { rolls: [r], natural: r };
  }
  const rolls = [rng(20), rng(20)];
  const natural = mode === 'advantage' ? Math.max(...rolls) : Math.min(...rolls);
  return { rolls, natural };
}

export function formatDie(d: DieResult): string {
  return d.rolls.length === 1 && d.value === d.rolls[0] ? String(d.value) : `${d.rolls[0]}→${d.value}`;
}
