// Static configuration shapes (mirrors src/data/character.json).

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type DamageType = 'slashing' | 'piercing' | 'bludgeoning' | 'cold' | 'fire' | 'necrotic' | 'radiant' | 'force';
export type MasteryId = 'graze' | 'cleave' | 'slow' | 'push' | 'sap';
export type ManeuverId = 'precision' | 'trip' | 'menacing' | 'riposte';
export type GwfMode = '2014' | '2024';
export type SituationKey = 'targetIsGiant';

export interface DiceSpec {
  count: number;
  sides: number;
}

export interface ExtraDamageConfig extends DiceSpec {
  label: string;
  type: DamageType;
  /** Only applies when this situational option is active. */
  when?: SituationKey;
}

export interface EffectConfig {
  text: string;
  when?: SituationKey;
  tone?: EffectTone;
}

export interface WeaponConfig {
  id: string;
  name: string;
  shortName?: string;
  baseWeapon: string;
  category: 'melee' | 'ranged';
  magicBonus: number;
  properties: string[];
  reach?: number;
  range?: { normal: number; long: number };
  attackAbility: Ability;
  damageAbilities: Ability[];
  /** Flat correction to weapon damage, for DM rulings that differ from the written rules. */
  damageBonusAdjustment?: number;
  damage: DiceSpec & { type: DamageType };
  extraDamage?: ExtraDamageConfig[];
  onHit?: EffectConfig[];
  mastery: MasteryId;
  strengthRequirement?: number;
  movementDisadvantageForSizes?: string[];
  primary?: boolean;
  notes?: string;
}

export interface CharacterConfig {
  character: {
    name: string;
    className: string;
    subclass: string;
    level: number;
    campaign: string;
    size: string;
  };
  abilityScores: Record<Ability, number>;
  proficiencyBonus: number;
  attacksPerAction: number;
  /** Action Surge uses per Short or Long Rest. */
  actionSurge: { uses: number };
  fightingStyles: string[];
  feats: { greatWeaponMaster: { enabled: boolean } };
  superiority: { count: number; die: number; saveAbility: Ability; maneuvers: ManeuverId[] };
  tacticalMaster: { enabled: boolean; options: MasteryId[] };
  rules: {
    greatWeaponFightingDefault: GwfMode;
    houseRules: {
      greatWeaponFightingAppliesToAllDamageDice: boolean;
      cleaveCountsAsPartOfAttackAction: boolean;
    };
  };
  weapons: WeaponConfig[];
  masteries: Record<MasteryId, { name: string; summary: string }>;
}

// Per-attack choices made in the UI.

export type RollMode = 'normal' | 'advantage' | 'disadvantage';
/** How the attack is being made — drives Great Weapon Master and Riposte. */
export type AttackSource = 'action' | 'bonus' | 'reaction' | 'riposte' | 'cleave';

export interface Situation {
  targetIsGiant: boolean;
  /** Javelin: thrown instead of melee. */
  thrown: boolean;
  /** Thrown/ranged attack beyond normal range. */
  longRange: boolean;
  /** Used (or will use) Speed this turn — matters for the Longbow. */
  moved: boolean;
}

export interface AttackOptions {
  rollMode: RollMode;
  source: AttackSource;
  /** Tactical Master replacement; undefined = weapon's own mastery. */
  masteryOverride?: MasteryId;
  situation: Situation;
}

// Roll results.

export interface DieResult {
  sides: number;
  /** Every face rolled, in order: [initial] or [initial, reroll]. */
  rolls: number[];
  value: number;
  /** Set when Great Weapon Fighting changed the result. */
  gwf?: GwfMode;
}

export interface Modifier {
  label: string;
  value: number;
}

export interface DamageTerm extends DiceSpec {
  label: string;
  type: DamageType;
  gwf: boolean;
}

export interface FlatDamage {
  type: DamageType;
  modifiers: Modifier[];
}

export interface DamagePlan {
  terms: DamageTerm[];
  flats: FlatDamage[];
}

export interface RolledTerm extends DamageTerm {
  dice: DieResult[];
  subtotal: number;
}

export interface DamageResult {
  terms: RolledTerm[];
  flats: FlatDamage[];
  byType: { type: DamageType; amount: number }[];
  total: number;
  gwfMode?: GwfMode;
  critical: boolean;
  /** e.g. "Graze" for miss damage. */
  label?: string;
}

export type EffectTone = 'save' | 'mastery' | 'feature' | 'info';

export interface Effect {
  text: string;
  tone: EffectTone;
}

export type Outcome = 'pending' | 'hit' | 'miss';

export interface AttackRecord {
  id: string;
  timestamp: number;
  weaponId: string;
  weaponName: string;
  source: AttackSource;
  /** Whether Great Weapon Master's "part of the Attack action on your turn" condition holds. */
  partOfAttackAction: boolean;
  /** 1-based position among Attack-action attacks this turn (undefined for other attacks). */
  attackNumber?: number;
  melee: boolean;
  rollMode: RollMode;
  rollModeNotes: string[];
  d20: number[];
  natural: number;
  /** A natural 1 the player chose to treat as an ordinary roll (e.g. an ally's effect). */
  natural1Ignored?: boolean;
  attackModifiers: Modifier[];
  precision?: DieResult;
  total: number;
  outcome: Outcome;
  critical: boolean;
  mastery: MasteryId;
  maneuver?: ManeuverId;
  superiorityDiceSpent: number;
  situation: Situation;
  damage?: DamageResult;
  effects: Effect[];
}
