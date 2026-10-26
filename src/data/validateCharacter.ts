import type { Ability, DamageType, EffectTone, GwfMode, ManeuverId, MasteryId, SituationKey } from '../rules/types';

// Runtime lists of the type unions. `Record<Union, true>` makes the compiler insist every member
// is listed, so they can't drift from types.ts.
const keys = <T extends string>(record: Record<T, true>) => Object.keys(record) as T[];
const ABILITIES = keys<Ability>({ str: true, dex: true, con: true, int: true, wis: true, cha: true });
const DAMAGE_TYPES = keys<DamageType>({
  slashing: true,
  piercing: true,
  bludgeoning: true,
  cold: true,
  fire: true,
  necrotic: true,
  radiant: true,
  force: true,
});
const MASTERIES = keys<MasteryId>({ graze: true, cleave: true, slow: true, push: true, sap: true });
const MANEUVERS = keys<ManeuverId>({ precision: true, trip: true, menacing: true, riposte: true });
const GWF_MODES = keys<GwfMode>({ 2014: true, 2024: true });
const SITUATIONS = keys<SituationKey>({ targetIsGiant: true });
const TONES = keys<EffectTone>({ save: true, mastery: true, feature: true, info: true });

// The rules engine matches these by exact string, so a typo would silently switch a rule off.
const PROPERTIES = ['ammunition', 'finesse', 'heavy', 'light', 'loading', 'reach', 'thrown', 'two-handed', 'versatile'];
const FIGHTING_STYLES = [
  'archery',
  'blindFighting',
  'defense',
  'dueling',
  'greatWeaponFighting',
  'interception',
  'protection',
  'thrownWeaponFighting',
  'twoWeaponFighting',
  'unarmedFighting',
];
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const DICE = [4, 6, 8, 10, 12, 20];

const WEAPON_KEYS = [
  'id',
  'name',
  'shortName',
  'baseWeapon',
  'category',
  'magicBonus',
  'properties',
  'reach',
  'range',
  'attackAbility',
  'damageAbilities',
  'damageBonusAdjustment',
  'damage',
  'extraDamage',
  'onHit',
  'mastery',
  'strengthRequirement',
  'movementDisadvantageForSizes',
  'primary',
  'notes',
];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (values: readonly (string | number)[]) => values.join(', ');

/**
 * Checks character.json beyond what the type cast can: allowed values, unique ids and misspelt
 * weapon fields. Returns one readable message per problem; an empty list means the file is fine.
 */
export function validateCharacter(data: unknown): string[] {
  const problems: string[] = [];
  const fail = (path: string, message: string) => problems.push(`${path}: ${message}`);

  const int = (v: unknown, path: string, min: number, max = Infinity) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
      fail(path, `must be a whole number${max === Infinity ? ` of at least ${min}` : ` from ${min} to ${max}`} (got ${JSON.stringify(v)})`);
    }
  };
  const text = (v: unknown, path: string) => {
    if (typeof v !== 'string' || !v.trim()) fail(path, `must be a non-empty text (got ${JSON.stringify(v)})`);
  };
  const bool = (v: unknown, path: string) => {
    if (typeof v !== 'boolean') fail(path, `must be true or false (got ${JSON.stringify(v)})`);
  };
  const oneOf = <T extends string | number>(v: unknown, path: string, allowed: readonly T[]) => {
    if (!allowed.includes(v as T)) fail(path, `must be one of ${list(allowed)} (got ${JSON.stringify(v)})`);
  };
  const each = (v: unknown, path: string, check: (item: unknown, path: string) => void) => {
    if (!Array.isArray(v)) return fail(path, 'must be a list [...]');
    v.forEach((item, i) => check(item, `${path}[${i}]`));
  };
  const obj = (v: unknown, path: string): Obj => {
    if (isObj(v)) return v;
    fail(path, 'must be an object {...}');
    return {};
  };
  const dice = (v: unknown, path: string) => {
    const d = obj(v, path);
    int(d.count, `${path}.count`, 1);
    oneOf(d.sides, `${path}.sides`, DICE);
    oneOf(d.type, `${path}.type`, DAMAGE_TYPES);
  };

  const cfg = obj(data, 'character.json');

  const character = obj(cfg.character, 'character');
  text(character.name, 'character.name');
  text(character.className, 'character.className');
  text(character.subclass, 'character.subclass');
  int(character.level, 'character.level', 1, 20);
  text(character.campaign, 'character.campaign');
  oneOf(character.size, 'character.size', SIZES);

  const scores = obj(cfg.abilityScores, 'abilityScores');
  for (const a of ABILITIES) int(scores[a], `abilityScores.${a}`, 1, 30);
  int(cfg.proficiencyBonus, 'proficiencyBonus', 2, 6);
  int(cfg.attacksPerAction, 'attacksPerAction', 1, 4);
  int(obj(cfg.actionSurge, 'actionSurge').uses, 'actionSurge.uses', 0, 2);
  each(cfg.fightingStyles, 'fightingStyles', (v, p) => oneOf(v, p, FIGHTING_STYLES));
  bool(obj(obj(cfg.feats, 'feats').greatWeaponMaster, 'feats.greatWeaponMaster').enabled, 'feats.greatWeaponMaster.enabled');

  const sup = obj(cfg.superiority, 'superiority');
  int(sup.count, 'superiority.count', 0, 10);
  oneOf(sup.die, 'superiority.die', DICE.filter((d) => d <= 12));
  oneOf(sup.saveAbility, 'superiority.saveAbility', ABILITIES);
  each(sup.maneuvers, 'superiority.maneuvers', (v, p) => oneOf(v, p, MANEUVERS));

  const tm = obj(cfg.tacticalMaster, 'tacticalMaster');
  bool(tm.enabled, 'tacticalMaster.enabled');
  each(tm.options, 'tacticalMaster.options', (v, p) => oneOf(v, p, MASTERIES));

  const rules = obj(cfg.rules, 'rules');
  oneOf(rules.greatWeaponFightingDefault, 'rules.greatWeaponFightingDefault', GWF_MODES);
  const house = obj(rules.houseRules, 'rules.houseRules');
  bool(house.greatWeaponFightingAppliesToAllDamageDice, 'rules.houseRules.greatWeaponFightingAppliesToAllDamageDice');
  bool(house.cleaveCountsAsPartOfAttackAction, 'rules.houseRules.cleaveCountsAsPartOfAttackAction');

  const masteries = obj(cfg.masteries, 'masteries');
  for (const m of MASTERIES) {
    const entry = obj(masteries[m], `masteries.${m}`);
    text(entry.name, `masteries.${m}.name`);
    text(entry.summary, `masteries.${m}.summary`);
  }

  const weapons = Array.isArray(cfg.weapons) ? cfg.weapons : [];
  if (weapons.length === 0) fail('weapons', 'needs at least one weapon');
  const ids = new Set<string>();
  weapons.forEach((raw, i) => {
    const w = obj(raw, `weapons[${i}]`);
    const at = `weapons[${i}] (${typeof w.id === 'string' ? w.id : 'no id'})`;

    for (const key of Object.keys(w)) {
      if (!WEAPON_KEYS.includes(key)) fail(`${at}.${key}`, `unknown field; is it misspelt? Known fields: ${list(WEAPON_KEYS)}`);
    }
    text(w.id, `${at}.id`);
    if (typeof w.id === 'string') {
      if (ids.has(w.id)) fail(`${at}.id`, 'is used by another weapon; ids must be unique');
      ids.add(w.id);
    }
    text(w.name, `${at}.name`);
    if (w.shortName !== undefined) text(w.shortName, `${at}.shortName`);
    text(w.baseWeapon, `${at}.baseWeapon`);
    oneOf(w.category, `${at}.category`, ['melee', 'ranged']);
    int(w.magicBonus, `${at}.magicBonus`, 0, 3);
    each(w.properties, `${at}.properties`, (v, p) => oneOf(v, p, PROPERTIES));
    if (w.reach !== undefined) int(w.reach, `${at}.reach`, 5);
    if (w.range !== undefined) {
      const r = obj(w.range, `${at}.range`);
      int(r.normal, `${at}.range.normal`, 5);
      int(r.long, `${at}.range.long`, 5);
      if (typeof r.normal === 'number' && typeof r.long === 'number' && r.long < r.normal) {
        fail(`${at}.range`, 'long must be at least normal');
      }
    } else if (w.category === 'ranged' || (Array.isArray(w.properties) && w.properties.includes('thrown'))) {
      fail(`${at}.range`, 'is required for ranged and thrown weapons');
    }
    oneOf(w.attackAbility, `${at}.attackAbility`, ABILITIES);
    each(w.damageAbilities, `${at}.damageAbilities`, (v, p) => oneOf(v, p, ABILITIES));
    if (w.damageBonusAdjustment !== undefined) int(w.damageBonusAdjustment, `${at}.damageBonusAdjustment`, -20, 20);
    dice(w.damage, `${at}.damage`);
    if (w.extraDamage !== undefined) {
      each(w.extraDamage, `${at}.extraDamage`, (v, p) => {
        dice(v, p);
        const e = obj(v, p);
        text(e.label, `${p}.label`);
        if (e.when !== undefined) oneOf(e.when, `${p}.when`, SITUATIONS);
      });
    }
    if (w.onHit !== undefined) {
      each(w.onHit, `${at}.onHit`, (v, p) => {
        const e = obj(v, p);
        text(e.text, `${p}.text`);
        if (e.when !== undefined) oneOf(e.when, `${p}.when`, SITUATIONS);
        if (e.tone !== undefined) oneOf(e.tone, `${p}.tone`, TONES);
      });
    }
    oneOf(w.mastery, `${at}.mastery`, MASTERIES);
    if (w.strengthRequirement !== undefined) int(w.strengthRequirement, `${at}.strengthRequirement`, 1, 30);
    if (w.movementDisadvantageForSizes !== undefined) {
      each(w.movementDisadvantageForSizes, `${at}.movementDisadvantageForSizes`, (v, p) => oneOf(v, p, SIZES));
    }
    if (w.primary !== undefined) bool(w.primary, `${at}.primary`);
    if (w.notes !== undefined) text(w.notes, `${at}.notes`);
  });
  if (weapons.filter((w) => isObj(w) && w.primary === true).length > 1) {
    fail('weapons', 'only one weapon can have "primary": true');
  }

  return problems;
}
