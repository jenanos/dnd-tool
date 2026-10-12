// Pure combat-state transitions. Every function takes the current state and returns the next one;
// illegal actions return the state unchanged (the UI disables them, this is the safety net).

import type { AttackOptions, AttackRecord, CharacterConfig, GwfMode, ManeuverId, Situation, WeaponConfig } from './types';
import { rollD20, type Rng } from './dice';
import {
  attackModifiers,
  buildDamagePlan,
  effectiveMastery,
  getWeapon,
  grazeDamage,
  hitEffects,
  isMeleeAttack,
  partOfAttackAction,
  resolveRollMode,
  rollDamagePlan,
  sumModifiers,
} from './character';

export interface CombatState {
  /** Superiority dice remaining. */
  superiority: number;
  /** Newest first. The current attack lives here too. */
  history: AttackRecord[];
  currentId: string | null;
  turn: { actionAttacks: number; cleaveUsed: boolean };
}

export interface Env {
  cfg: CharacterConfig;
  rng: Rng;
  now?: number;
  newId?: () => string;
}

export const HISTORY_LIMIT = 40;

export type Phase = 'ready' | 'rolled' | 'hit' | 'damage' | 'miss';

export function initialCombatState(cfg: CharacterConfig): CombatState {
  return { superiority: cfg.superiority.count, history: [], currentId: null, turn: { actionAttacks: 0, cleaveUsed: false } };
}

export const currentAttack = (s: CombatState) =>
  s.currentId ? s.history.find((a) => a.id === s.currentId) : undefined;

export function phaseOf(a: AttackRecord | undefined): Phase {
  if (!a) return 'ready';
  if (a.outcome === 'pending') return 'rolled';
  if (a.outcome === 'miss') return 'miss';
  return a.damage ? 'damage' : 'hit';
}

const hasManeuver = (cfg: CharacterConfig, m: ManeuverId) => cfg.superiority.maneuvers.includes(m);

function replaceCurrent(s: CombatState, next: AttackRecord): CombatState {
  return { ...s, history: s.history.map((a) => (a.id === next.id ? next : a)) };
}

let idCounter = 0;
const defaultId = () => `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

// --- Starting attacks -------------------------------------------------------

export function canRiposte(s: CombatState, cfg: CharacterConfig, w: WeaponConfig, situation: Situation) {
  return hasManeuver(cfg, 'riposte') && s.superiority > 0 && isMeleeAttack(w, situation);
}

export function canCleave(s: CombatState) {
  const a = currentAttack(s);
  return !!a && phaseOf(a) === 'damage' && a.mastery === 'cleave' && a.melee && !s.turn.cleaveUsed;
}

export function startAttack(s: CombatState, env: Env, weaponId: string, options: AttackOptions): CombatState {
  const { cfg, rng } = env;
  const w = getWeapon(cfg, weaponId);
  const { source, situation } = options;
  const parent = currentAttack(s);

  if (source === 'riposte' && !canRiposte(s, cfg, w, situation)) return s;
  if (source === 'cleave' && (!canCleave(s) || parent?.weaponId !== w.id)) return s;

  const { mode, notes } = resolveRollMode(cfg, w, options.rollMode, situation);
  const { rolls, natural } = rollD20(mode, rng);
  const mods = attackModifiers(cfg, w);
  const inAction = partOfAttackAction(cfg, source, parent?.partOfAttackAction);

  let record: AttackRecord = {
    id: (env.newId ?? defaultId)(),
    timestamp: env.now ?? Date.now(),
    weaponId: w.id,
    weaponName: w.name,
    source,
    partOfAttackAction: inAction,
    attackNumber: source === 'action' ? s.turn.actionAttacks + 1 : undefined,
    melee: isMeleeAttack(w, situation),
    rollMode: mode,
    rollModeNotes: notes,
    d20: rolls,
    natural,
    attackModifiers: mods,
    total: natural + sumModifiers(mods),
    outcome: 'pending',
    critical: false,
    // The Cleave follow-up uses the weapon's own mastery; Tactical Master was spent on the first attack.
    mastery: source === 'cleave' ? w.mastery : effectiveMastery(cfg, w, options.masteryOverride),
    maneuver: source === 'riposte' ? 'riposte' : undefined,
    superiorityDiceSpent: source === 'riposte' ? 1 : 0,
    situation: { ...situation },
    effects: [],
  };

  // Natural 20 always hits and crits; natural 1 always misses.
  if (natural === 20) record = { ...record, outcome: 'hit', critical: true };
  else if (natural === 1) record = withMiss(record, cfg);

  return {
    superiority: s.superiority - record.superiorityDiceSpent,
    history: [record, ...s.history].slice(0, HISTORY_LIMIT),
    currentId: record.id,
    turn: {
      actionAttacks: source === 'action' ? s.turn.actionAttacks + 1 : s.turn.actionAttacks,
      cleaveUsed: s.turn.cleaveUsed || source === 'cleave',
    },
  };
}

// --- Resolving the attack roll ---------------------------------------------

function withMiss(a: AttackRecord, cfg: CharacterConfig): AttackRecord {
  const w = getWeapon(cfg, a.weaponId);
  return {
    ...a,
    outcome: 'miss',
    critical: false,
    damage: a.mastery === 'graze' ? grazeDamage(cfg, w) : undefined,
    effects: [],
  };
}

export function canPrecision(s: CombatState, cfg: CharacterConfig) {
  const a = currentAttack(s);
  return (
    !!a &&
    hasManeuver(cfg, 'precision') &&
    s.superiority > 0 &&
    !a.maneuver &&
    a.natural !== 1 &&
    (phaseOf(a) === 'rolled' || phaseOf(a) === 'miss')
  );
}

/** Precision Attack: add a superiority die to the existing attack roll. Never rerolls the d20. */
export function applyPrecision(s: CombatState, env: Env): CombatState {
  if (!canPrecision(s, env.cfg)) return s;
  const a = currentAttack(s)!;
  const face = env.rng(env.cfg.superiority.die);
  const next: AttackRecord = {
    ...a,
    precision: { sides: env.cfg.superiority.die, rolls: [face], value: face },
    total: a.total + face,
    maneuver: 'precision',
    superiorityDiceSpent: a.superiorityDiceSpent + 1,
    // Back to "awaiting the DM" with the new total.
    outcome: 'pending',
    damage: undefined,
  };
  return { ...replaceCurrent(s, next), superiority: s.superiority - 1 };
}

/** Mark the pending attack as hit or miss (or correct an earlier call before damage is rolled). */
export function resolveAttack(s: CombatState, cfg: CharacterConfig, outcome: 'hit' | 'miss'): CombatState {
  const a = currentAttack(s);
  const phase = phaseOf(a);
  if (!a || (phase !== 'rolled' && phase !== 'hit' && phase !== 'miss')) return s;
  const next = outcome === 'miss' ? withMiss(a, cfg) : { ...a, outcome: 'hit' as const, critical: a.natural === 20, damage: undefined };
  return replaceCurrent(s, next);
}

export function setCritical(s: CombatState, critical: boolean): CombatState {
  const a = currentAttack(s);
  if (!a || phaseOf(a) !== 'hit') return s;
  return replaceCurrent(s, { ...a, critical });
}

// --- Damage -----------------------------------------------------------------

export function canUseDamageManeuver(s: CombatState, cfg: CharacterConfig, m: ManeuverId) {
  const a = currentAttack(s);
  return !!a && phaseOf(a) === 'hit' && !a.maneuver && hasManeuver(cfg, m) && s.superiority > 0;
}

export function rollDamage(
  s: CombatState,
  env: Env,
  opts: { gwfMode: GwfMode; maneuver?: 'trip' | 'menacing'; situation: Situation },
): CombatState {
  const a = currentAttack(s);
  // Only from the "hit" phase — an existing damage roll is never silently re-rolled.
  if (!a || phaseOf(a) !== 'hit') return s;
  if (opts.maneuver && !canUseDamageManeuver(s, env.cfg, opts.maneuver)) return s;

  const w = getWeapon(env.cfg, a.weaponId);
  const maneuver = a.maneuver ?? opts.maneuver;
  const spent = opts.maneuver ? 1 : 0;
  const situation = { ...a.situation, targetIsGiant: opts.situation.targetIsGiant };
  const plan = buildDamagePlan(env.cfg, w, {
    critical: a.critical,
    melee: a.melee,
    partOfAttackAction: a.partOfAttackAction,
    cleave: a.source === 'cleave',
    maneuver,
    situation,
  });
  const damage = rollDamagePlan(plan, env.rng, opts.gwfMode, a.critical);
  const next: AttackRecord = {
    ...a,
    maneuver,
    situation,
    superiorityDiceSpent: a.superiorityDiceSpent + spent,
    damage,
    effects: hitEffects(env.cfg, w, { mastery: a.mastery, maneuver, critical: a.critical, situation }),
  };
  return { ...replaceCurrent(s, next), superiority: s.superiority - spent };
}

// --- Turn & resources -------------------------------------------------------

export const clearCurrent = (s: CombatState): CombatState => ({ ...s, currentId: null });

export const newTurn = (s: CombatState): CombatState => ({
  ...s,
  currentId: null,
  turn: { actionAttacks: 0, cleaveUsed: false },
});

export function adjustSuperiority(s: CombatState, cfg: CharacterConfig, delta: number): CombatState {
  const superiority = Math.min(cfg.superiority.count, Math.max(0, s.superiority + delta));
  return { ...s, superiority };
}

export const restoreSuperiority = (s: CombatState, cfg: CharacterConfig): CombatState => ({
  ...s,
  superiority: cfg.superiority.count,
});

export const clearHistory = (s: CombatState): CombatState => ({
  ...s,
  history: s.history.filter((a) => a.id === s.currentId),
});

/** Validates persisted state against the current config; falls back to a fresh state on anything odd. */
export function sanitizeCombatState(raw: unknown, cfg: CharacterConfig): CombatState {
  const fresh = initialCombatState(cfg);
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Partial<CombatState>;
  const superiority =
    typeof r.superiority === 'number' && Number.isFinite(r.superiority)
      ? Math.min(cfg.superiority.count, Math.max(0, Math.round(r.superiority)))
      : fresh.superiority;
  const history = Array.isArray(r.history)
    ? r.history.filter((a) => a && typeof a.id === 'string' && Array.isArray(a.d20) && cfg.weapons.some((w) => w.id === a.weaponId)).slice(0, HISTORY_LIMIT)
    : [];
  const currentId = typeof r.currentId === 'string' && history.some((a) => a.id === r.currentId) ? r.currentId : null;
  const turn =
    r.turn && typeof r.turn.actionAttacks === 'number'
      ? { actionAttacks: Math.max(0, r.turn.actionAttacks), cleaveUsed: !!r.turn.cleaveUsed }
      : fresh.turn;
  return { superiority, history, currentId, turn };
}
