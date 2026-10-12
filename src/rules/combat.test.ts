import { describe, expect, it } from 'vitest';
import config from '../data/character.json';
import type { AttackOptions, CharacterConfig, DamageResult, Situation } from './types';
import { scriptedRng } from './dice';
import { buildDamagePlan, defaultOptions, formatPlan, getWeapon, hewApplies, maneuverSaveDc, resolveRollMode } from './character';
import {
  activateActionSurge,
  adjustSuperiority,
  canActionSurge,
  hasActionFor,
  ignoreNatural1,
  newTurn,
  setOverride,
  applyPrecision,
  canCleave,
  canPrecision,
  currentAttack,
  initialCombatState,
  phaseOf,
  resolveAttack,
  rest,
  rollDamage,
  sanitizeCombatState,
  setCritical,
  startAttack,
  type CombatState,
} from './combat';

const cfg = config as CharacterConfig;
const EVENTIDE = 'eventide-frost';
const AXE = 'greataxe';
const JAVELIN = 'giant-slayer-javelin';
const BOW = 'lord-of-the-feast';

const env = (faces: number[]) => ({ cfg, rng: scriptedRng(faces) });
const opts = (o: Omit<Partial<AttackOptions>, 'situation'> & { situation?: Partial<Situation> } = {}): AttackOptions => {
  const base = defaultOptions();
  return { ...base, ...o, situation: { ...base.situation, ...o.situation } };
};
const noSituation = defaultOptions().situation;

function attack(faces: number[], weapon = EVENTIDE, o?: Parameters<typeof opts>[0], s = initialCombatState(cfg)) {
  return startAttack(s, env(faces), weapon, opts(o));
}

function hitAndDamage(s: CombatState, faces: number[], extra: Partial<Parameters<typeof rollDamage>[2]> = {}) {
  const hit = phaseOf(currentAttack(s)) === 'rolled' ? resolveAttack(s, cfg, 'hit') : s;
  return rollDamage(hit, env(faces), { gwfMode: '2024', situation: noSituation, ...extra });
}

const amount = (d: DamageResult | undefined, type: string) => d?.byType.find((t) => t.type === type)?.amount ?? 0;

describe('character config', () => {
  it('derives the maneuver DC from STR', () => {
    expect(maneuverSaveDc(cfg)).toBe(17);
  });

  it.each([
    [EVENTIDE, '2d6 + 10 Slashing · 1d6 Cold'],
    [AXE, '1d12 + 10 Slashing'],
    [JAVELIN, '1d6 + 6 Piercing'],
    [BOW, '2d6 + 10 Piercing'],
  ])('%s deals %s on an Attack-action hit', (id, formula) => {
    const w = getWeapon(cfg, id);
    const plan = buildDamagePlan(cfg, w, {
      critical: false,
      melee: w.category === 'melee',
      partOfAttackAction: true,
      situation: noSituation,
    });
    expect(formatPlan(plan)).toBe(formula);
  });
});

describe('attack roll', () => {
  it('adds +10 for Eventide Frost and +5 for the Longbow', () => {
    expect(currentAttack(attack([14]))?.total).toBe(24);
    expect(currentAttack(attack([14], BOW))?.total).toBe(19);
  });

  it('natural 20 is an automatic critical hit', () => {
    const a = currentAttack(attack([20]))!;
    expect(a.outcome).toBe('hit');
    expect(a.critical).toBe(true);
    expect(phaseOf(a)).toBe('hit');
  });

  it('natural 1 is an automatic miss even though 1 + 10 could hit', () => {
    const a = currentAttack(attack([1]))!;
    expect(a.outcome).toBe('miss');
    expect(a.total).toBe(11);
  });

  it('keeps both d20s with advantage', () => {
    const a = currentAttack(attack([3, 15], EVENTIDE, { rollMode: 'advantage' }))!;
    expect(a.d20).toEqual([3, 15]);
    expect(a.total).toBe(25);
  });

  it('counts Attack-action attacks per turn but not reactions', () => {
    let s = attack([10]);
    s = attack([10], EVENTIDE, {}, s);
    s = attack([10], EVENTIDE, { source: 'reaction' }, s);
    expect(s.turn.actionAttacks).toBe(2);
    expect(currentAttack(s)?.attackNumber).toBeUndefined();
    expect(s.history[1].attackNumber).toBe(2);
  });
});

describe('critical hit and natural 1 overrides', () => {
  it('a natural 20 crit can be cancelled (target immune to crits) and still hits', () => {
    const s = setCritical(attack([20]), false);
    const a = currentAttack(hitAndDamage(s, [4, 4, 4]))!;
    expect(a.outcome).toBe('hit');
    expect(a.damage!.critical).toBe(false);
    expect(a.damage!.terms.map((t) => t.count)).toEqual([2, 1]);
  });

  it('a natural 1 can be treated as an ordinary roll', () => {
    const s = ignoreNatural1(attack([1]));
    const a = currentAttack(s)!;
    expect(phaseOf(a)).toBe('rolled');
    expect(a.total).toBe(11);
    expect(a.damage).toBeUndefined();
    expect(canPrecision(s, cfg)).toBe(true);
    expect(currentAttack(applyPrecision(s, env([7])))!.total).toBe(18);
  });

  it('only natural 1s can be ignored', () => {
    const s = resolveAttack(attack([5]), cfg, 'miss');
    expect(ignoreNatural1(s)).toBe(s);
  });
});

describe('turn economy', () => {
  it('allows two Attack-action attacks, then blocks until Action Surge', () => {
    let s = attack([10]);
    s = attack([10], EVENTIDE, {}, s);
    expect(hasActionFor(s, cfg, 'action')).toBe(false);
    expect(attack([10], EVENTIDE, {}, s)).toBe(s);

    s = activateActionSurge(s);
    expect(s.actionSurge).toBe(0);
    s = attack([10], EVENTIDE, {}, s);
    s = attack([10], EVENTIDE, {}, s);
    expect(currentAttack(s)!.attackNumber).toBe(4);
    expect(attack([10], EVENTIDE, {}, s)).toBe(s);
  });

  it('Action Surge is once per turn and limited by uses until a rest', () => {
    let s = activateActionSurge(initialCombatState(cfg));
    expect(canActionSurge(s)).toBe(false);
    s = newTurn(s);
    expect(s.turn.actionSurged).toBe(false);
    expect(canActionSurge(s)).toBe(false); // no uses left
    expect(canActionSurge(rest(s, cfg))).toBe(true);
  });

  it('one bonus action and one reaction per turn', () => {
    let s = attack([10], EVENTIDE, { source: 'bonus' });
    expect(attack([10], EVENTIDE, { source: 'bonus' }, s)).toBe(s);
    s = attack([10], EVENTIDE, { source: 'riposte' }, s);
    expect(s.superiority).toBe(4);
    expect(attack([10], EVENTIDE, { source: 'reaction' }, s)).toBe(s);
    expect(attack([10], EVENTIDE, { source: 'riposte' }, s)).toBe(s);
    // Attack action is unaffected.
    expect(hasActionFor(s, cfg, 'action')).toBe(true);
  });

  it('override lifts every limit until the next turn', () => {
    let s = setOverride(attack([10], EVENTIDE, { source: 'bonus' }), true);
    s = attack([10], EVENTIDE, { source: 'bonus' }, s);
    for (let i = 0; i < 4; i++) s = attack([10], EVENTIDE, {}, s);
    expect(s.turn.actionAttacks).toBe(4);
    expect(s.history).toHaveLength(6);
    s = newTurn(s);
    expect(s.turn.override).toBe(false);
    expect(s.turn.bonusActionUsed).toBe(false);
  });
});

describe('Graze', () => {
  it('deals 5 slashing on a miss, with no cold damage and no dice', () => {
    const s = resolveAttack(attack([5]), cfg, 'miss');
    const a = currentAttack(s)!;
    expect(a.damage?.total).toBe(5);
    expect(amount(a.damage, 'slashing')).toBe(5);
    expect(amount(a.damage, 'cold')).toBe(0);
    expect(a.damage?.terms).toHaveLength(0);
  });

  it('applies on a natural 1', () => {
    expect(currentAttack(attack([1]))?.damage?.total).toBe(5);
  });

  it('is replaced, not kept, when Tactical Master picks another mastery', () => {
    const s = resolveAttack(attack([5], EVENTIDE, { masteryOverride: 'push' }), cfg, 'miss');
    expect(currentAttack(s)?.mastery).toBe('push');
    expect(currentAttack(s)?.damage).toBeUndefined();
  });

  it('weapons without Graze deal nothing on a miss', () => {
    const s = resolveAttack(attack([5], AXE), cfg, 'miss');
    expect(currentAttack(s)?.damage).toBeUndefined();
  });
});

describe('Eventide Frost damage', () => {
  it('rolls 2d6 + 10 slashing and 1d6 cold, with 2024 GWF on every die', () => {
    // Slashing 1→3, 5 ; Cold 2→3
    const s = hitAndDamage(attack([14]), [1, 5, 2]);
    const d = currentAttack(s)!.damage!;
    expect(amount(d, 'slashing')).toBe(18);
    expect(amount(d, 'cold')).toBe(3);
    expect(d.total).toBe(21);
  });

  it('2014 GWF rerolls 1s and 2s once on weapon and extra dice', () => {
    // Slashing 1→2 (kept), 6 ; Cold 2→6
    const s = hitAndDamage(attack([14]), [1, 2, 6, 2, 6], { gwfMode: '2014' });
    const d = currentAttack(s)!.damage!;
    expect(amount(d, 'slashing')).toBe(2 + 6 + 10);
    expect(amount(d, 'cold')).toBe(6);
  });

  it('critical hit doubles all dice but not the +10', () => {
    // Slashing 4d6: 6,6,6,6 ; Cold 2d6: 6,6
    const s = hitAndDamage(attack([20]), [6, 6, 6, 6, 6, 6]);
    const d = currentAttack(s)!.damage!;
    expect(d.terms.map((t) => `${t.count}d${t.sides}`)).toEqual(['4d6', '2d6']);
    expect(amount(d, 'slashing')).toBe(34);
    expect(amount(d, 'cold')).toBe(12);
  });

  it('critical Trip Attack rolls 2d8 but spends one superiority die', () => {
    // 4d6 slashing, 2d8 trip, 2d6 cold — all 1s become 3s under GWF 2024
    const s = hitAndDamage(attack([20]), [1, 1, 1, 1, 1, 1, 1, 1], { maneuver: 'trip' });
    const a = currentAttack(s)!;
    expect(a.damage!.terms.map((t) => `${t.count}d${t.sides} ${t.label}`)).toEqual([
      '4d6 Greatsword',
      '2d8 Trip Attack',
      '2d6 Frost',
    ]);
    expect(amount(a.damage, 'slashing')).toBe(4 * 3 + 2 * 3 + 10);
    expect(amount(a.damage, 'cold')).toBe(6);
    expect(s.superiority).toBe(4);
    expect(a.superiorityDiceSpent).toBe(1);
    expect(a.effects.map((e) => e.text).join()).toContain('STR Save DC 17');
  });

  it('Menacing Attack shows the WIS save', () => {
    const s = hitAndDamage(attack([12]), [3, 3, 3, 3], { maneuver: 'menacing' });
    expect(currentAttack(s)!.effects.map((e) => e.text).join()).toContain('WIS Save DC 17');
  });

  it('suggests Hew on a melee critical hit', () => {
    const s = hitAndDamage(attack([20]), [3, 3, 3, 3, 3, 3]);
    expect(currentAttack(s)!.effects.some((e) => e.text.startsWith('Hew'))).toBe(true);
  });

  it('Hew is possible with melee weapons only (crit or target reduced to 0 HP)', () => {
    expect([EVENTIDE, AXE, JAVELIN, BOW].map((id) => hewApplies(cfg, getWeapon(cfg, id)))).toEqual([true, true, true, false]);
    const s = hitAndDamage(attack([12]), [3, 3, 3]);
    expect(currentAttack(s)!.effects.some((e) => e.text.startsWith('Hew'))).toBe(false);
  });

  it('never re-rolls damage that has already been rolled', () => {
    const s = hitAndDamage(attack([14]), [4, 4, 4]);
    const again = rollDamage(s, env([6, 6, 6]), { gwfMode: '2014', situation: noSituation });
    expect(again).toBe(s);
  });

  it('can mark a non-20 hit as critical (e.g. paralysed target)', () => {
    const s = setCritical(resolveAttack(attack([12]), cfg, 'hit'), true);
    const d = currentAttack(hitAndDamage(s, [3, 3, 3, 3, 3, 3]))!.damage!;
    expect(d.critical).toBe(true);
    expect(d.terms[0].count).toBe(4);
  });
});

describe('Great Weapon Master', () => {
  it('does not apply to Riposte: 2d6 + 6 slashing, 1d6 cold, 1d8 superiority', () => {
    let s = attack([15], EVENTIDE, { source: 'riposte' });
    expect(s.superiority).toBe(4); // spent when the reaction is used
    s = hitAndDamage(s, [4, 4, 5, 4]);
    const a = currentAttack(s)!;
    expect(a.damage!.flats[0].modifiers.map((m) => m.label)).toEqual(['STR', 'Magic']);
    expect(amount(a.damage, 'slashing')).toBe(4 + 4 + 5 + 6);
    expect(amount(a.damage, 'cold')).toBe(4);
    expect(s.superiority).toBe(4);
  });

  it('Riposte spends its die even on a miss', () => {
    const s = resolveAttack(attack([3], EVENTIDE, { source: 'riposte' }), cfg, 'miss');
    expect(s.superiority).toBe(4);
    expect(currentAttack(s)?.damage?.total).toBe(5); // Graze still applies
  });

  it('does not apply to bonus-action or opportunity attacks', () => {
    for (const source of ['bonus', 'reaction'] as const) {
      const s = hitAndDamage(attack([15], EVENTIDE, { source }), [4, 4, 4]);
      expect(amount(currentAttack(s)!.damage, 'slashing')).toBe(14);
    }
  });

  it('does not apply to the non-Heavy javelin', () => {
    const s = hitAndDamage(attack([15], JAVELIN), [4]);
    expect(currentAttack(s)!.damage!.total).toBe(10);
  });
});

describe('Precision Attack', () => {
  it('adds a d8 to the existing roll without rerolling the d20', () => {
    const s0 = attack([8]);
    const s1 = applyPrecision(s0, env([6]));
    const a = currentAttack(s1)!;
    expect(a.d20).toEqual([8]);
    expect(a.total).toBe(24);
    expect(a.precision?.value).toBe(6);
    expect(a.outcome).toBe('pending');
    expect(s1.superiority).toBe(4);
  });

  it('is not affected by Great Weapon Fighting', () => {
    const a = currentAttack(applyPrecision(attack([8]), env([1])))!;
    expect(a.total).toBe(19);
  });

  it('cannot rescue a natural 1', () => {
    const s = attack([1]);
    expect(canPrecision(s, cfg)).toBe(false);
    expect(applyPrecision(s, env([8]))).toBe(s);
  });

  it('cannot be used without superiority dice', () => {
    const s = adjustSuperiority(attack([8]), cfg, -5);
    expect(s.superiority).toBe(0);
    expect(canPrecision(s, cfg)).toBe(false);
  });

  it('only one maneuver per attack: no Trip after Precision', () => {
    let s = applyPrecision(attack([8]), env([6]));
    expect(canPrecision(s, cfg)).toBe(false);
    s = resolveAttack(s, cfg, 'hit');
    const after = rollDamage(s, env([3, 3, 3, 3]), { gwfMode: '2024', maneuver: 'trip', situation: noSituation });
    expect(after).toBe(s);
  });

  it('the die is spent even if the attack still misses', () => {
    const s = resolveAttack(applyPrecision(attack([3]), env([2])), cfg, 'miss');
    expect(s.superiority).toBe(4);
    expect(currentAttack(s)?.damage?.total).toBe(5);
  });
});

describe('superiority dice', () => {
  it('cannot go below zero or above the maximum', () => {
    let s = initialCombatState(cfg);
    s = adjustSuperiority(s, cfg, 3);
    expect(s.superiority).toBe(5);
    s = adjustSuperiority(s, cfg, -9);
    expect(s.superiority).toBe(0);
    expect(rest(s, cfg).superiority).toBe(5);
  });

  it('blocks Trip and Riposte at zero dice', () => {
    const empty = { ...initialCombatState(cfg), superiority: 0 };
    expect(attack([15], EVENTIDE, { source: 'riposte' }, empty)).toBe(empty);
    const hit = resolveAttack(attack([15], EVENTIDE, {}, empty), cfg, 'hit');
    expect(rollDamage(hit, env([3, 3, 3, 3]), { gwfMode: '2024', maneuver: 'trip', situation: noSituation })).toBe(hit);
  });

  it('restoring dice does not touch the static config', () => {
    const before = JSON.stringify(config);
    rest(adjustSuperiority(initialCombatState(cfg), cfg, -2), cfg);
    expect(JSON.stringify(config)).toBe(before);
  });
});

describe('Greataxe and Cleave', () => {
  it('offers Cleave once per turn after a hit, without the STR modifier', () => {
    let s = hitAndDamage(attack([15], AXE), [6]);
    expect(canCleave(s)).toBe(true);
    s = startAttack(s, env([14]), AXE, opts({ source: 'cleave' }));
    expect(canCleave(s)).toBe(false);
    s = hitAndDamage(s, [6]);
    const a = currentAttack(s)!;
    expect(a.source).toBe('cleave');
    expect(a.damage!.flats[0].modifiers.map((m) => m.label)).toEqual(['Magic', 'GWM']);
    expect(a.damage!.total).toBe(6 + 1 + 4);
    expect(canCleave(s)).toBe(false);
    // Still blocked after another hit this turn.
    s = hitAndDamage(attack([15], AXE, {}, s), [6]);
    expect(canCleave(s)).toBe(false);
  });

  it('a Cleave from a reaction attack does not get GWM', () => {
    let s = hitAndDamage(attack([15], AXE, { source: 'reaction' }), [6]);
    s = hitAndDamage(startAttack(s, env([14]), AXE, opts({ source: 'cleave' })), [6]);
    expect(currentAttack(s)!.damage!.total).toBe(7);
  });

  it('is not available when Tactical Master replaced Cleave', () => {
    const s = hitAndDamage(attack([15], AXE, { masteryOverride: 'sap' }), [6]);
    expect(canCleave(s)).toBe(false);
  });
});

describe('Giant Slayer Javelin', () => {
  it('adds 2d6 piercing and the DC 15 save only against Giants', () => {
    const normal = currentAttack(hitAndDamage(attack([15], JAVELIN), [4]))!;
    expect(normal.damage!.total).toBe(10);

    const giant = currentAttack(
      hitAndDamage(attack([15], JAVELIN), [4, 5, 6], { situation: { ...noSituation, targetIsGiant: true } }),
    )!;
    expect(giant.damage!.total).toBe(10 + 11);
    expect(giant.effects.map((e) => e.text).join()).toContain('DC 15 STR');
    expect(giant.effects.map((e) => e.text).join()).toContain('Slow');
  });

  it('does not use Great Weapon Fighting', () => {
    const d = currentAttack(hitAndDamage(attack([15], JAVELIN), [1]))!.damage!;
    expect(d.total).toBe(7);
  });

  it('long-range throws have disadvantage; melee throws ignore range', () => {
    const w = getWeapon(cfg, JAVELIN);
    expect(resolveRollMode(cfg, w, 'normal', { ...noSituation, thrown: true, longRange: true }).mode).toBe('disadvantage');
    expect(resolveRollMode(cfg, w, 'normal', { ...noSituation, longRange: true }).mode).toBe('normal');
  });

  it('a thrown javelin cannot Riposte', () => {
    const s = initialCombatState(cfg);
    expect(attack([15], JAVELIN, { source: 'riposte', situation: { thrown: true } }, s)).toBe(s);
  });
});

describe("Lord of the Feast's Longbow", () => {
  it('uses DEX to hit, STR + DEX + GWM to damage, and no GWF', () => {
    const s = hitAndDamage(attack([10], BOW), [1, 2]);
    const a = currentAttack(s)!;
    expect(a.total).toBe(15);
    expect(a.melee).toBe(false);
    expect(a.damage!.flats[0].modifiers.map((m) => `${m.label}${m.value}`)).toEqual(['STR5', 'DEX1', 'GWM4']);
    expect(a.damage!.total).toBe(1 + 2 + 10);
    expect(a.damage!.gwfMode).toBeUndefined();
  });

  it('moving imposes disadvantage on a Medium wielder, cancelling advantage', () => {
    const w = getWeapon(cfg, BOW);
    const moved = { ...noSituation, moved: true };
    expect(resolveRollMode(cfg, w, 'normal', moved).mode).toBe('disadvantage');
    expect(resolveRollMode(cfg, w, 'advantage', moved).mode).toBe('normal');
    expect(resolveRollMode(cfg, w, 'normal', noSituation).mode).toBe('normal');
  });

  it('shows Push on a hit', () => {
    const s = hitAndDamage(attack([10], BOW), [3, 3]);
    expect(currentAttack(s)!.effects.some((e) => e.text.startsWith('Push'))).toBe(true);
  });
});

describe('house rule switch', () => {
  it('limits GWF to weapon dice when the house rule is off', () => {
    const strict: CharacterConfig = {
      ...cfg,
      rules: { ...cfg.rules, houseRules: { ...cfg.rules.houseRules, greatWeaponFightingAppliesToAllDamageDice: false } },
    };
    const plan = buildDamagePlan(strict, getWeapon(strict, EVENTIDE), {
      critical: false,
      melee: true,
      partOfAttackAction: true,
      maneuver: 'trip',
      situation: noSituation,
    });
    expect(plan.terms.map((t) => t.gwf)).toEqual([true, false, false]);
  });
});

describe('persistence', () => {
  it('sanitizes stored state against the config', () => {
    expect(sanitizeCombatState({ superiority: 99 }, cfg).superiority).toBe(5);
    expect(sanitizeCombatState('garbage', cfg)).toEqual(initialCombatState(cfg));
    const s = attack([12]);
    expect(sanitizeCombatState(JSON.parse(JSON.stringify(s)), cfg)).toEqual(s);
  });
});
