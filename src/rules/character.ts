import type {
  Ability,
  AttackOptions,
  AttackSource,
  CharacterConfig,
  DamagePlan,
  DamageResult,
  DamageTerm,
  DamageType,
  Effect,
  FlatDamage,
  GwfMode,
  ManeuverId,
  MasteryId,
  Modifier,
  RollMode,
  Situation,
  WeaponConfig,
} from './types';
import { rollDamageDie, type Rng } from './dice';

export const ABILITY_LABEL: Record<Ability, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);
export const mod = (cfg: CharacterConfig, ability: Ability) => abilityMod(cfg.abilityScores[ability]);
export const sumModifiers = (mods: Modifier[]) => mods.reduce((n, m) => n + m.value, 0);

export function getWeapon(cfg: CharacterConfig, id: string | undefined): WeaponConfig {
  return cfg.weapons.find((w) => w.id === id) ?? cfg.weapons.find((w) => w.primary) ?? cfg.weapons[0];
}

export function maneuverSaveDc(cfg: CharacterConfig): number {
  return 8 + cfg.proficiencyBonus + mod(cfg, cfg.superiority.saveAbility);
}

const has = (w: WeaponConfig, property: string) => w.properties.includes(property);

export const canThrow = (w: WeaponConfig) => w.category === 'melee' && has(w, 'thrown');
export const isThrown = (w: WeaponConfig, s: Situation) => canThrow(w) && s.thrown;
export const isMeleeAttack = (w: WeaponConfig, s: Situation) => w.category === 'melee' && !isThrown(w, s);
export const usesRange = (w: WeaponConfig, s: Situation) => !!w.range && !isMeleeAttack(w, s);
export const hasMovementPenalty = (cfg: CharacterConfig, w: WeaponConfig) =>
  !!w.movementDisadvantageForSizes?.includes(cfg.character.size);
export const hasGiantOption = (w: WeaponConfig) =>
  !!w.extraDamage?.some((e) => e.when === 'targetIsGiant') || !!w.onHit?.some((e) => e.when === 'targetIsGiant');

export function attackModifiers(cfg: CharacterConfig, w: WeaponConfig): Modifier[] {
  const mods: Modifier[] = [
    { label: ABILITY_LABEL[w.attackAbility], value: mod(cfg, w.attackAbility) },
    { label: 'Proficiency', value: cfg.proficiencyBonus },
  ];
  if (w.magicBonus) mods.push({ label: 'Magic', value: w.magicBonus });
  return mods;
}

/** Disadvantage sources that come from the weapon and situation rather than the player's choice. */
export function forcedDisadvantages(cfg: CharacterConfig, w: WeaponConfig, s: Situation): string[] {
  const reasons: string[] = [];
  if (w.strengthRequirement && cfg.abilityScores.str < w.strengthRequirement)
    reasons.push(`STR below ${w.strengthRequirement}`);
  if (hasMovementPenalty(cfg, w) && s.moved) reasons.push('Moved this turn');
  if (usesRange(w, s) && s.longRange) reasons.push('Long range');
  return reasons;
}

export function resolveRollMode(
  cfg: CharacterConfig,
  w: WeaponConfig,
  chosen: RollMode,
  s: Situation,
): { mode: RollMode; notes: string[] } {
  const forced = forcedDisadvantages(cfg, w, s);
  if (forced.length === 0) return { mode: chosen, notes: [] };
  if (chosen === 'advantage') return { mode: 'normal', notes: [...forced, 'Advantage and Disadvantage cancel'] };
  return { mode: 'disadvantage', notes: forced };
}

export function effectiveMastery(cfg: CharacterConfig, w: WeaponConfig, override?: MasteryId): MasteryId {
  if (override && cfg.tacticalMaster.enabled && cfg.tacticalMaster.options.includes(override)) return override;
  return w.mastery;
}

/** Great Weapon Master: Heavy weapon, as part of the Attack action on your turn. */
export function partOfAttackAction(cfg: CharacterConfig, source: AttackSource, parentPartOfAction = false): boolean {
  if (source === 'action') return true;
  if (source === 'cleave') return parentPartOfAction && cfg.rules.houseRules.cleaveCountsAsPartOfAttackAction;
  return false;
}

export const gwmApplies = (cfg: CharacterConfig, w: WeaponConfig, inAttackAction: boolean) =>
  cfg.feats.greatWeaponMaster.enabled && has(w, 'heavy') && inAttackAction;

/** Great Weapon Fighting: melee attack with a weapon held in two hands. */
export const gwfApplies = (cfg: CharacterConfig, w: WeaponConfig, melee: boolean) =>
  cfg.fightingStyles.includes('greatWeaponFighting') && melee && has(w, 'two-handed');

export function weaponDamageModifiers(
  cfg: CharacterConfig,
  w: WeaponConfig,
  opts: { partOfAttackAction: boolean; cleave?: boolean },
): Modifier[] {
  const mods: Modifier[] = [];
  for (const ability of w.damageAbilities) {
    const value = mod(cfg, ability);
    // Cleave: don't add the ability modifier unless it is negative.
    if (opts.cleave && value > 0) continue;
    mods.push({ label: ABILITY_LABEL[ability], value });
  }
  if (w.magicBonus) mods.push({ label: 'Magic', value: w.magicBonus });
  if (w.damageBonusAdjustment) mods.push({ label: 'Adjustment', value: w.damageBonusAdjustment });
  if (gwmApplies(cfg, w, opts.partOfAttackAction)) mods.push({ label: 'GWM', value: cfg.proficiencyBonus });
  return mods;
}

export const MANEUVER_NAMES: Record<ManeuverId, string> = {
  precision: 'Precision Attack',
  trip: 'Trip Attack',
  menacing: 'Menacing Attack',
  riposte: 'Riposte',
};

/** Maneuvers whose superiority die is added to damage on a hit. */
export const DAMAGE_MANEUVERS: ManeuverId[] = ['trip', 'menacing', 'riposte'];

export interface DamageContext {
  critical: boolean;
  melee: boolean;
  partOfAttackAction: boolean;
  cleave?: boolean;
  maneuver?: ManeuverId;
  situation: Situation;
}

export function buildDamagePlan(cfg: CharacterConfig, w: WeaponConfig, ctx: DamageContext): DamagePlan {
  const mult = ctx.critical ? 2 : 1;
  const gwf = gwfApplies(cfg, w, ctx.melee);
  const gwfExtra = gwf && cfg.rules.houseRules.greatWeaponFightingAppliesToAllDamageDice;

  const terms: DamageTerm[] = [
    { label: w.baseWeapon, type: w.damage.type, count: w.damage.count * mult, sides: w.damage.sides, gwf },
  ];
  if (ctx.maneuver && DAMAGE_MANEUVERS.includes(ctx.maneuver)) {
    terms.push({
      label: MANEUVER_NAMES[ctx.maneuver],
      type: w.damage.type,
      count: mult,
      sides: cfg.superiority.die,
      gwf: gwfExtra,
    });
  }
  for (const extra of w.extraDamage ?? []) {
    if (extra.when && !ctx.situation[extra.when]) continue;
    terms.push({ label: extra.label, type: extra.type, count: extra.count * mult, sides: extra.sides, gwf: gwfExtra });
  }

  const modifiers = weaponDamageModifiers(cfg, w, { partOfAttackAction: ctx.partOfAttackAction, cleave: ctx.cleave });
  const flats: FlatDamage[] = modifiers.length ? [{ type: w.damage.type, modifiers }] : [];
  return { terms, flats };
}

export function rollDamagePlan(plan: DamagePlan, rng: Rng, gwfMode: GwfMode, critical: boolean): DamageResult {
  const terms = plan.terms.map((t) => {
    const dice = Array.from({ length: t.count }, () => rollDamageDie(t.sides, rng, t.gwf ? gwfMode : undefined));
    return { ...t, dice, subtotal: dice.reduce((n, d) => n + d.value, 0) };
  });
  const usesGwf = plan.terms.some((t) => t.gwf);
  return summarize({ terms, flats: plan.flats, critical, gwfMode: usesGwf ? gwfMode : undefined });
}

function summarize(r: Omit<DamageResult, 'byType' | 'total'>): DamageResult {
  const amounts = new Map<DamageType, number>();
  const add = (type: DamageType, n: number) => amounts.set(type, (amounts.get(type) ?? 0) + n);
  r.terms.forEach((t) => add(t.type, t.subtotal));
  r.flats.forEach((f) => add(f.type, sumModifiers(f.modifiers)));
  // Damage can't drop below 0 for a type (e.g. a negative modifier on a low roll).
  const byType = [...amounts].map(([type, amount]) => ({ type, amount: Math.max(0, amount) }));
  return { ...r, byType, total: byType.reduce((n, t) => n + t.amount, 0) };
}

/** Graze: on a miss, damage equal to the attack's ability modifier — no dice, no other bonuses. */
export function grazeDamage(cfg: CharacterConfig, w: WeaponConfig): DamageResult | undefined {
  const value = mod(cfg, w.attackAbility);
  if (value <= 0) return undefined;
  return summarize({
    terms: [],
    flats: [{ type: w.damage.type, modifiers: [{ label: ABILITY_LABEL[w.attackAbility], value }] }],
    critical: false,
    label: 'Graze',
  });
}

/** Great Weapon Master's Hew: a crit or a 0 HP drop with a melee weapon allows a Bonus Action attack. */
export const hewApplies = (cfg: CharacterConfig, w: WeaponConfig) =>
  cfg.feats.greatWeaponMaster.enabled && w.category === 'melee';

/** Reminders shown with a hit: saving throws, mastery effects and triggered features. */
export function hitEffects(
  cfg: CharacterConfig,
  w: WeaponConfig,
  a: { mastery: MasteryId; maneuver?: ManeuverId; critical: boolean; situation: Situation },
): Effect[] {
  const dc = maneuverSaveDc(cfg);
  const effects: Effect[] = [];
  if (a.maneuver === 'trip') effects.push({ tone: 'save', text: `STR Save DC ${dc} — Prone on failure (Large or smaller)` });
  if (a.maneuver === 'menacing')
    effects.push({ tone: 'save', text: `WIS Save DC ${dc} — Frightened until end of your next turn` });
  for (const e of w.onHit ?? []) {
    if (e.when && !a.situation[e.when]) continue;
    effects.push({ tone: e.tone ?? 'info', text: e.text });
  }
  if (a.mastery !== 'graze' && a.mastery !== 'cleave') {
    const m = cfg.masteries[a.mastery];
    effects.push({ tone: 'mastery', text: `${m.name}: ${m.summary}` });
  }
  if (a.critical && hewApplies(cfg, w))
    effects.push({ tone: 'feature', text: 'Hew: you may make one attack with this weapon as a Bonus Action' });
  return effects;
}

/** Short formula for display, e.g. "2d6 + 10 Slashing · 1d6 Cold". */
export function formatPlan(plan: DamagePlan): string {
  const types: DamageType[] = [];
  plan.terms.forEach((t) => !types.includes(t.type) && types.push(t.type));
  plan.flats.forEach((f) => !types.includes(f.type) && types.push(f.type));
  return types
    .map((type) => {
      const flat = plan.flats.filter((f) => f.type === type).reduce((n, f) => n + sumModifiers(f.modifiers), 0);
      const parts = plan.terms.filter((t) => t.type === type).map((t) => `${t.count}d${t.sides}`);
      if (flat) parts.push(String(flat));
      return `${parts.join(' + ').replace('+ -', '− ')} ${capitalize(type)}`;
    })
    .join(' · ');
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const formatBonus = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

export function defaultOptions(): AttackOptions {
  return {
    rollMode: 'normal',
    source: 'action',
    situation: { targetIsGiant: false, thrown: false, longRange: false, moved: false },
  };
}
