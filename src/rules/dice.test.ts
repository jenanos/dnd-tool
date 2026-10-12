import { describe, expect, it } from 'vitest';
import { cryptoRng, formatDie, rollD20, rollDamageDie, scriptedRng } from './dice';

describe('Great Weapon Fighting 2024', () => {
  it.each([
    [1, 3],
    [2, 3],
    [3, 3],
    [5, 5],
  ])('a rolled %i counts as %i', (face, value) => {
    const d = rollDamageDie(6, scriptedRng([face]), '2024');
    expect(d.value).toBe(value);
    expect(d.rolls).toEqual([face]);
  });

  it('never rolls an extra die', () => {
    const rng = scriptedRng([1, 6]);
    rollDamageDie(6, rng, '2024');
    expect(rng.remaining()).toBe(1);
  });
});

describe('Great Weapon Fighting 2014', () => {
  it('rerolls a 1 once and keeps the new roll', () => {
    expect(rollDamageDie(6, scriptedRng([1, 5]), '2014')).toEqual({ sides: 6, rolls: [1, 5], value: 5, gwf: '2014' });
  });

  it('keeps a second 1 or 2 — no repeated rerolls', () => {
    const rng = scriptedRng([2, 1, 6]);
    expect(rollDamageDie(6, rng, '2014').value).toBe(1);
    expect(rng.remaining()).toBe(1);
  });

  it('does not reroll 3 or higher', () => {
    const rng = scriptedRng([4, 1]);
    expect(rollDamageDie(6, rng, '2014')).toEqual({ sides: 6, rolls: [4], value: 4 });
    expect(rng.remaining()).toBe(1);
  });
});

describe('without Great Weapon Fighting', () => {
  it('uses the raw face', () => {
    expect(rollDamageDie(6, scriptedRng([1]))).toEqual({ sides: 6, rolls: [1], value: 1 });
  });
});

describe('d20', () => {
  it('advantage keeps the higher roll and both faces', () => {
    expect(rollD20('advantage', scriptedRng([4, 17]))).toEqual({ rolls: [4, 17], natural: 17 });
  });
  it('disadvantage keeps the lower roll', () => {
    expect(rollD20('disadvantage', scriptedRng([4, 17]))).toEqual({ rolls: [4, 17], natural: 4 });
  });
  it('normal rolls one die', () => {
    expect(rollD20('normal', scriptedRng([11]))).toEqual({ rolls: [11], natural: 11 });
  });
});

describe('formatDie', () => {
  it('shows adjustments', () => {
    expect(formatDie({ sides: 6, rolls: [1], value: 3, gwf: '2024' })).toBe('1→3');
    expect(formatDie({ sides: 6, rolls: [2, 6], value: 6, gwf: '2014' })).toBe('2→6');
    expect(formatDie({ sides: 6, rolls: [5], value: 5 })).toBe('5');
  });
});

describe('cryptoRng', () => {
  it('stays within range', () => {
    for (let i = 0; i < 2000; i++) {
      const n = cryptoRng(8);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(8);
    }
  });
});
