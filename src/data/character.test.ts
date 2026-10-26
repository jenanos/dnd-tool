import { describe, expect, it } from 'vitest';
import { defaultOptions } from '../rules/character';
import { currentAttack, initialCombatState, resolveAttack, rollDamage, startAttack } from '../rules/combat';
import { scriptedRng } from '../rules/dice';
import fixture from '../rules/fixtures/character.json';
import data from './character.json';
import { config } from './config';
import { validateCharacter } from './validateCharacter';

// These tests check the live character file, whatever its numbers are. The rules themselves are
// tested against a frozen copy in src/rules/fixtures, so a level-up never needs a test change.

describe('character.json', () => {
  it('is valid', () => {
    expect(validateCharacter(data)).toEqual([]);
  });

  it.each(config.weapons.map((w) => [w.id] as const))('%s can roll to hit and deal damage', (id) => {
    const options = defaultOptions();
    // Generous dice: a hit, and plenty of faces for every damage die including crits.
    const env = { cfg: config, rng: scriptedRng([15, ...Array(40).fill(4)]) };
    const rolled = startAttack(initialCombatState(config), env, id, options);
    const attack = currentAttack(rolled);
    expect(attack?.weaponId).toBe(id);
    expect(Number.isFinite(attack?.total)).toBe(true);

    const damaged = rollDamage(resolveAttack(rolled, config, 'hit'), env, { gwfMode: '2024', situation: options.situation });
    const damage = currentAttack(damaged)?.damage;
    expect(damage && Number.isFinite(damage.total) && damage.total > 0).toBe(true);
  });
});

describe('validateCharacter', () => {
  it('accepts the test fixture', () => {
    expect(validateCharacter(fixture)).toEqual([]);
  });

  it('reports typos and bad values by path', () => {
    const broken = structuredClone(fixture) as unknown as { weapons: Record<string, unknown>[]; abilityScores: Record<string, unknown> };
    broken.abilityScores.str = '20';
    broken.weapons[0].properties = ['heavy', 'two-handled'];
    broken.weapons[0].magicBonsu = 1;
    broken.weapons[1].id = broken.weapons[0].id;
    broken.weapons[2].damage = { count: 1, sides: 7, type: 'piercing' };
    expect(validateCharacter(broken)).toEqual([
      'abilityScores.str: must be a whole number from 1 to 30 (got "20")',
      expect.stringContaining('weapons[0] (eventide-frost).magicBonsu: unknown field; is it misspelt?'),
      'weapons[0] (eventide-frost).properties[1]: must be one of ammunition, finesse, heavy, light, loading, reach, thrown, two-handed, versatile (got "two-handled")',
      'weapons[1] (eventide-frost).id: is used by another weapon; ids must be unique',
      'weapons[2] (giant-slayer-javelin).damage.sides: must be one of 4, 6, 8, 10, 12, 20 (got 7)',
    ]);
  });
});
