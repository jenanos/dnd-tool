import { useEffect, useState } from 'react';
import { config } from '../data/config';
import { cryptoRng } from '../rules/dice';
import { defaultOptions, getWeapon } from '../rules/character';
import * as combatRules from '../rules/combat';
import type { CombatState } from '../rules/combat';
import type { AttackOptions, AttackSource, GwfMode, MasteryId, RollMode, Situation } from '../rules/types';
import { readJson, writeJson } from './storage';

const SETTINGS_KEY = 'eventide.settings.v1';
const COMBAT_KEY = 'eventide.combat.v1';
const UNDO_LIMIT = 25;

export interface Settings {
  gwfMode: GwfMode;
  weaponId: string;
  /** Situational toggles that tend to hold across attacks. "moved" is per turn and not persisted. */
  targetIsGiant: boolean;
  thrown: boolean;
  longRange: boolean;
}

function loadSettings(): Settings {
  const raw = (readJson(SETTINGS_KEY) ?? {}) as Partial<Settings>;
  return {
    gwfMode: raw.gwfMode === '2014' || raw.gwfMode === '2024' ? raw.gwfMode : config.rules.greatWeaponFightingDefault,
    weaponId: getWeapon(config, raw.weaponId).id,
    targetIsGiant: !!raw.targetIsGiant,
    thrown: !!raw.thrown,
    longRange: !!raw.longRange,
  };
}

const env = () => ({ cfg: config, rng: cryptoRng });

export type ManualSource = Exclude<AttackSource, 'riposte' | 'cleave'>;

export function useCompanion() {
  const [settings, setSettings] = useState(loadSettings);
  const [combat, setCombat] = useState<CombatState>(() => combatRules.sanitizeCombatState(readJson(COMBAT_KEY), config));
  const [undoStack, setUndoStack] = useState<{ label: string; state: CombatState }[]>([]);
  // Per-attack choices: deliberately not persisted, and reset after use where they're one-offs.
  const [rollMode, setRollMode] = useState<RollMode>('normal');
  const [source, setSource] = useState<ManualSource>('action');
  const [masteryOverride, setMasteryOverride] = useState<MasteryId | undefined>();
  const [moved, setMoved] = useState(false);

  useEffect(() => writeJson(SETTINGS_KEY, settings), [settings]);
  useEffect(() => writeJson(COMBAT_KEY, combat), [combat]);

  const weapon = getWeapon(config, settings.weaponId);
  const situation: Situation = {
    targetIsGiant: settings.targetIsGiant,
    thrown: settings.thrown,
    longRange: settings.longRange,
    moved,
  };
  const options: AttackOptions = { ...defaultOptions(), rollMode, source, masteryOverride, situation };
  const current = combatRules.currentAttack(combat);
  const phase = combatRules.phaseOf(current);

  function commit(label: string, next: CombatState) {
    if (next === combat) return;
    setUndoStack((stack) => [{ label, state: combat }, ...stack].slice(0, UNDO_LIMIT));
    setCombat(next);
  }

  function roll(src: AttackSource) {
    const labels: Record<AttackSource, string> = {
      action: 'attack',
      bonus: 'bonus attack',
      reaction: 'reaction attack',
      riposte: 'Riposte',
      cleave: 'Cleave',
    };
    commit(labels[src], combatRules.startAttack(combat, env(), weapon.id, { ...options, source: src }));
    setSource('action');
    setMasteryOverride(undefined);
  }

  return {
    config,
    weapon,
    settings,
    combat,
    current,
    phase,
    options,
    source,
    situation,
    undoLabel: undoStack[0]?.label,

    canRiposte: combatRules.canRiposte(combat, config, weapon, situation),
    /** The selected attack type still has its action / bonus action / reaction this turn. */
    canRoll: combatRules.hasActionFor(combat, config, source),
    hasActionFor: (src: AttackSource) => combatRules.hasActionFor(combat, config, src),
    canActionSurge: combatRules.canActionSurge(combat),
    attackLimit: combatRules.attackActionLimit(combat, config),
    canPrecision: combatRules.canPrecision(combat, config),
    canCleave: combatRules.canCleave(combat) && current?.weaponId === weapon.id,
    canDamageManeuver: (m: 'trip' | 'menacing') => combatRules.canUseDamageManeuver(combat, config, m),

    setRollMode,
    setSource,
    setMasteryOverride,
    setMoved,
    setGwfMode: (gwfMode: GwfMode) => setSettings((s) => ({ ...s, gwfMode })),
    setSituation: (patch: Partial<Pick<Settings, 'targetIsGiant' | 'thrown' | 'longRange'>>) =>
      setSettings((s) => ({ ...s, ...patch })),
    selectWeapon(id: string) {
      if (id === settings.weaponId) return;
      setSettings((s) => ({ ...s, weaponId: id }));
      setMasteryOverride(undefined);
      setCombat((c) => combatRules.clearCurrent(c));
    },

    rollToHit: () => roll(source),
    riposte: () => roll('riposte'),
    cleave: () => roll('cleave'),
    hew: () => roll('bonus'),
    precision: () => commit('Precision Attack', combatRules.applyPrecision(combat, env())),
    markHit: () => commit('hit', combatRules.resolveAttack(combat, config, 'hit')),
    markMiss: () => commit('miss', combatRules.resolveAttack(combat, config, 'miss')),
    setCritical: (critical: boolean) =>
      commit(critical ? 'critical hit' : 'cancel critical', combatRules.setCritical(combat, critical)),
    ignoreNatural1: () => commit('ignore natural 1', combatRules.ignoreNatural1(combat)),
    actionSurge: () => commit('Action Surge', combatRules.activateActionSurge(combat)),
    setOverride: (on: boolean) => commit(on ? 'override' : 'override off', combatRules.setOverride(combat, on)),
    rollDamage: (maneuver?: 'trip' | 'menacing') =>
      commit(
        maneuver === 'trip' ? 'Trip Attack' : maneuver === 'menacing' ? 'Menacing Attack' : 'damage',
        combatRules.rollDamage(combat, env(), { gwfMode: settings.gwfMode, maneuver, situation }),
      ),
    newTurn() {
      commit('new turn', combatRules.newTurn(combat));
      setMoved(false);
      setRollMode('normal');
    },
    adjustSuperiority: (delta: number) =>
      commit('superiority adjustment', combatRules.adjustSuperiority(combat, config, delta)),
    rest: () => commit('rest', combatRules.rest(combat, config)),
    clearHistory: () => commit('clear history', combatRules.clearHistory(combat)),
    undo() {
      const [last, ...rest] = undoStack;
      if (!last) return;
      setCombat(last.state);
      setUndoStack(rest);
    },
  };
}

export type Companion = ReturnType<typeof useCompanion>;
