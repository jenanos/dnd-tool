import { useState } from 'react';
import { ChevronDown, Crosshair, Dices, Flag, RotateCcw, Shield, ShieldOff, Skull, Sparkles, Swords, Undo2, Zap } from 'lucide-react';
import {
  attackModifiers,
  buildDamagePlan,
  canThrow,
  effectiveMastery,
  formatBonus,
  formatPlan,
  forcedDisadvantages,
  getWeapon,
  gwfApplies,
  hasGiantOption,
  hasMovementPenalty,
  hewApplies,
  isMeleeAttack,
  MANEUVER_NAMES,
  partOfAttackAction,
  sumModifiers,
  usesRange,
} from '../rules/character';
import type { AttackRecord, AttackSource, MasteryId, RollMode } from '../rules/types';
import type { Companion, ManualSource } from '../state/useCompanion';
import { DamageDetails, DamageTypeChips, EffectList } from './DamageView';
import { TurnSummary } from './TurnSummary';
import { attackBonusText, attackCalc, attackNumberLabel, typeName } from './format';
import { Button, Crystal, cx, Segmented, Toggle } from './ui';

/** `compact`: the phone layout pins the turn summary and the main buttons outside the card. */
export function AttackCard({ c, compact = false }: { c: Companion; compact?: boolean }) {
  const { current, phase } = c;
  // On a phone the weapon and roll setup folds to one line once an attack is under way, so the
  // result fits on screen. Opening it lasts for that attack only.
  const [setupOpenFor, setSetupOpenFor] = useState<string>();
  const folded = compact && phase !== 'ready' && !!current && setupOpenFor !== current.id;
  return (
    <section
      key={current?.critical ? `${current.id}-crit` : undefined}
      aria-label="Attack"
      className={cx(
        'panel relative overflow-hidden sm:p-6',
        compact ? 'p-3.5' : 'p-4',
        current?.critical && phase !== 'ready' ? 'animate-crit border-delerium/40' : 'border-octarine/20',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-octarine/10 blur-3xl"
      />
      <div className="relative space-y-4 sm:space-y-5">
        {folded ? (
          <SetupLine c={c} onOpen={() => setSetupOpenFor(current.id)} />
        ) : (
          <>
            <WeaponSummary c={c} />
            <AttackControls c={c} />
          </>
        )}
        <div className="sm:min-h-[17rem]">
          {phase === 'ready' && <ReadyStage c={c} />}
          {phase === 'rolled' && current && <RolledStage c={c} a={current} />}
          {phase === 'hit' && current && <HitStage key={current.id} c={c} a={current} />}
          {phase === 'damage' && current && <DamageStage key={current.id} c={c} a={current} />}
          {phase === 'miss' && current && <MissStage c={c} a={current} />}
        </div>
        {!compact && (
          <>
            <TurnSummary c={c} />
            <PrimaryActions c={c} />
          </>
        )}
      </div>
    </section>
  );
}

function WeaponSummary({ c }: { c: Companion }) {
  const w = c.weapon;
  const { situation, options } = c;
  const melee = isMeleeAttack(w, situation);
  const plan = buildDamagePlan(c.config, w, {
    critical: false,
    melee,
    partOfAttackAction: partOfAttackAction(c.config, options.source),
    situation,
  });
  const badge = turnBadge(c);
  const tags = [
    w.baseWeapon,
    ...w.properties.map((p) => p.replace(/(^|-)\w/g, (m) => m.toUpperCase())),
    w.range && !melee ? `${w.range.normal}/${w.range.long} ft` : w.reach ? `Reach ${w.reach} ft` : undefined,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="font-display text-[1.35rem] leading-tight font-bold tracking-wide text-bone sm:text-3xl">{w.name}</h2>
        <p className="mt-1 text-xs text-mist">{tags.join(' · ')}</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold text-octarine-soft tabular-nums">
            {formatBonus(sumModifiers(attackModifiers(c.config, w)))} to hit
          </span>
          <span className="text-bone/90 tabular-nums">{formatPlan(plan)}</span>
          {gwfApplies(c.config, w, melee) && (
            <span className="rounded-md border border-octarine/30 px-1.5 py-0.5 text-[0.7rem] text-octarine-soft">
              GWF {c.settings.gwfMode}
            </span>
          )}
          {badge && <span className="text-[0.7rem] text-mist sm:hidden">{badge}</span>}
        </p>
      </div>
      {badge && (
        <span className="label-caps hidden rounded-full border border-white/10 bg-abyss/60 px-3 py-1.5 text-mist sm:inline">
          {badge}
        </span>
      )}
    </div>
  );
}

function SetupLine({ c, onOpen }: { c: Companion; onOpen: () => void }) {
  const w = c.weapon;
  const forced = forcedDisadvantages(c.config, w, c.situation).length > 0;
  const badge = turnBadge(c);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Show weapon and roll options"
      className="flex min-h-10 w-full items-center gap-2.5 rounded-xl border border-white/6 bg-abyss/40 px-3 text-left text-sm"
    >
      <span className="truncate font-display font-semibold text-bone">{w.shortName ?? w.name}</span>
      <span className="shrink-0 font-semibold text-octarine-soft tabular-nums">{formatBonus(sumModifiers(attackModifiers(c.config, w)))}</span>
      <span className="ml-auto shrink-0 text-xs text-mist">
        <span className={cx('capitalize', forced ? 'text-ember' : c.options.rollMode !== 'normal' && 'text-octarine-soft')}>
          {forced && c.options.rollMode === 'normal' ? 'disadvantage' : c.options.rollMode}
        </span>
        {badge && ` · ${badge}`}
      </span>
      <ChevronDown className="size-4 shrink-0 text-mist" />
    </button>
  );
}

const SOURCE_BADGE: Record<AttackSource, string> = {
  action: 'Attack action',
  bonus: 'Bonus action',
  reaction: 'Reaction',
  riposte: 'Riposte · Reaction',
  cleave: 'Cleave',
};

function turnBadge(c: Companion): string | undefined {
  const { turn } = c.combat;
  const per = c.config.attacksPerAction;
  const a = c.phase === 'ready' ? undefined : c.current;
  if (a?.attackNumber) return attackNumberLabel(a.attackNumber, per, turn.actionSurged);
  if (a) return SOURCE_BADGE[a.source];
  if (c.source !== 'action') return `${SOURCE_BADGE[c.source]}${c.canRoll ? '' : ' used'}`;
  return c.canRoll ? attackNumberLabel(turn.actionAttacks + 1, per, turn.actionSurged) : 'Attacks used';
}

function AttackControls({ c }: { c: Companion }) {
  const w = c.weapon;
  const { situation } = c;
  const [open, setOpen] = useState(false);
  const forced = forcedDisadvantages(c.config, w, situation);
  const mastery = effectiveMastery(c.config, w, c.options.masteryOverride);
  const masteryChoices: MasteryId[] = [w.mastery, ...c.config.tacticalMaster.options.filter((m) => m !== w.mastery)];
  const advancedActive = c.source !== 'action' || mastery !== w.mastery;

  return (
    <div className="space-y-3">
      <Segmented<RollMode>
        label="Roll mode"
        value={c.options.rollMode}
        onChange={c.setRollMode}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'advantage', label: 'Advantage' },
          { value: 'disadvantage', label: 'Disadvantage' },
        ]}
      />

      {(canThrow(w) || hasGiantOption(w) || hasMovementPenalty(c.config, w) || usesRange(w, situation)) && (
        <div className="flex flex-wrap gap-2">
          {canThrow(w) && (
            <Toggle checked={situation.thrown} onChange={(thrown) => c.setSituation({ thrown })}>
              Thrown
            </Toggle>
          )}
          {usesRange(w, situation) && (
            <Toggle checked={situation.longRange} onChange={(longRange) => c.setSituation({ longRange })} tone="warn">
              Long range ({w.range!.normal + 1}–{w.range!.long} ft)
            </Toggle>
          )}
          {hasMovementPenalty(c.config, w) && (
            <Toggle checked={situation.moved} onChange={c.setMoved} tone="warn">
              Moved this turn
            </Toggle>
          )}
          {hasGiantOption(w) && (
            <Toggle checked={situation.targetIsGiant} onChange={(targetIsGiant) => c.setSituation({ targetIsGiant })}>
              Target is Giant
            </Toggle>
          )}
        </div>
      )}

      {forced.length > 0 && (
        <p className="text-xs text-ember">
          Disadvantage: {forced.join(', ')}
          {c.options.rollMode === 'advantage' && ' — cancels your Advantage'}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-9 items-center gap-1.5 text-xs text-mist hover:text-bone"
        >
          <ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} />
          Attack type & Tactical Master
          {advancedActive && (
            <span className="ml-1 rounded-md bg-octarine/15 px-1.5 py-0.5 text-octarine-soft">
              {[c.source !== 'action' && SOURCE_LABELS[c.source], mastery !== w.mastery && c.config.masteries[mastery].name]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </button>
        {open && (
          <div className="mt-2 grid gap-3 rounded-xl border border-white/6 bg-abyss/40 p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="label-caps text-mist">Attack type</p>
              <Segmented<ManualSource>
                label="Attack type"
                size="sm"
                value={c.source}
                onChange={c.setSource}
                options={(['action', 'bonus', 'reaction'] as const).map((s) => ({
                  value: s,
                  label: SOURCE_LABELS[s],
                  disabled: s !== c.source && !c.hasActionFor(s),
                }))}
              />
              <p className="text-xs text-mist">Great Weapon Master's bonus only applies to the Attack action on your turn.</p>
            </div>
            {c.config.tacticalMaster.enabled && (
              <div className="space-y-1.5">
                <p className="label-caps text-mist">Mastery</p>
                <Segmented<MasteryId>
                  label="Weapon mastery"
                  size="sm"
                  value={mastery}
                  onChange={(m) => c.setMasteryOverride(m === w.mastery ? undefined : m)}
                  options={masteryChoices.map((m) => ({ value: m, label: c.config.masteries[m].name, title: c.config.masteries[m].summary }))}
                />
                <p className="text-xs text-mist">{c.config.masteries[mastery].summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const SOURCE_LABELS: Record<ManualSource, string> = { action: 'Attack action', bonus: 'Bonus action', reaction: 'Reaction' };

// --- Stages ------------------------------------------------------------------

function BigNumber({ value, label, tone = 'violet', id }: { value: string | number; label: string; tone?: 'violet' | 'crit' | 'muted'; id: string }) {
  return (
    <div key={id} className="animate-rise text-center">
      <div
        className={cx(
          'font-display text-[4.5rem] leading-none font-bold tabular-nums sm:text-[7rem]',
          tone === 'violet' && 'text-bone text-glow',
          tone === 'crit' && 'text-delerium [text-shadow:0_0_36px_rgb(169_245_182/0.6)]',
          tone === 'muted' && 'text-mist/80',
        )}
      >
        {value}
      </div>
      <div className={cx('label-caps mt-1.5 text-sm sm:mt-2', tone === 'crit' ? 'text-delerium' : 'text-octarine-soft')}>{label}</div>
    </div>
  );
}

function D20Calc({ a, prefix }: { a: AttackRecord; prefix?: string }) {
  const keptIndex = a.d20.indexOf(a.natural);
  return (
    <p className="mt-3 text-center font-mono text-sm text-mist">
      {prefix}d20 (
      {a.d20.map((r, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <span className={cx(i === keptIndex ? 'text-bone' : 'line-through opacity-60', (r === 20 || r === 1) && i === keptIndex && 'text-delerium')}>
            {r}
          </span>
        </span>
      ))}
      ) {attackBonusText(a)}
      {a.rollMode !== 'normal' && <span className="ml-2 text-xs text-octarine-soft">{a.rollMode}</span>}
    </p>
  );
}

function ReadyStage({ c }: { c: Companion }) {
  return (
    <div className="flex h-full min-h-[8.5rem] flex-col items-center justify-center gap-2 text-center sm:min-h-[17rem] sm:gap-3">
      <div className="relative">
        <div aria-hidden className="absolute inset-0 rounded-full bg-octarine/20 blur-2xl" />
        <Crosshair className="relative size-10 text-octarine/70 sm:size-14" strokeWidth={1.2} />
      </div>
      <p className="label-caps text-mist">{c.canRoll ? 'Ready to attack' : 'Turn complete'}</p>
      <p className="max-w-xs text-sm text-mist/80">
        {!c.canRoll
          ? c.canActionSurge && c.source === 'action'
            ? 'Both attacks used. Action Surge for two more, or start the next turn.'
            : 'Nothing left this turn. Riposte still works on their turns.'
          : c.combat.superiority > 0
            ? 'Roll to hit, call the total to your DM.'
            : 'No superiority dice left — Short Rest restores them.'}
      </p>
    </div>
  );
}

function RolledStage({ c, a }: { c: Companion; a: AttackRecord }) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <BigNumber id={`${a.id}-${a.total}`} value={a.total} label="to hit" />
        <D20Calc a={a} />
        {a.rollModeNotes.length > 0 && <p className="mt-1 text-center text-xs text-ember">{a.rollModeNotes.join(' · ')}</p>}
        {a.natural1Ignored && <p className="mt-1 text-center text-xs text-octarine-soft">Natural 1 ignored — counts as a normal roll</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="hit" size="lg" onClick={c.markHit}>
          <Swords className="size-5" /> Hit
        </Button>
        <Button variant="miss" size="lg" onClick={c.markMiss}>
          <Shield className="size-5" /> Miss
        </Button>
      </div>
      <PrecisionButton c={c} a={a} />
    </div>
  );
}

function PrecisionButton({ c, a }: { c: Companion; a: AttackRecord }) {
  if (a.maneuver || (a.natural === 1 && !a.natural1Ignored) || !c.config.superiority.maneuvers.includes('precision')) return null;
  return (
    <Button variant="magic" size="lg" className="w-full" onClick={c.precision} disabled={!c.canPrecision}>
      <Crystal filled={c.combat.superiority > 0} size={12} />
      Precision Attack
      <span className="text-xs opacity-75">
        {c.combat.superiority > 0 ? `+1d${c.config.superiority.die} to hit` : 'no dice left'}
      </span>
    </Button>
  );
}

function HitStage({ c, a }: { c: Companion; a: AttackRecord }) {
  const [maneuver, setManeuver] = useState<'none' | 'trip' | 'menacing'>('none');
  const dmgManeuvers = (['trip', 'menacing'] as const).filter((m) => c.config.superiority.maneuvers.includes(m));
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="text-center">
        {a.critical ? (
          <p className="animate-rise font-display text-4xl font-bold tracking-[0.12em] text-delerium uppercase [text-shadow:0_0_30px_rgb(169_245_182/0.55)] sm:text-5xl">
            Critical Hit
          </p>
        ) : (
          <p className="animate-rise font-display text-4xl font-bold tracking-[0.12em] text-bone uppercase sm:text-5xl">Hit</p>
        )}
        <p className="mt-2 font-mono text-sm text-mist">
          {a.total} to hit · {attackCalc(a)}
        </p>
      </div>

      {a.maneuver === 'riposte' ? (
        <p className="rounded-xl border border-octarine/30 bg-octarine/10 px-4 py-3 text-center text-sm text-octarine-soft">
          Riposte — superiority die added to damage
        </p>
      ) : a.maneuver === 'precision' ? (
        <p className="text-center text-xs text-mist">Precision Attack used — no other maneuver on this attack.</p>
      ) : (
        <div className="space-y-1.5">
          <p className="label-caps text-center text-mist">Maneuver</p>
          <Segmented
            label="Damage maneuver"
            value={maneuver}
            onChange={setManeuver}
            options={[
              { value: 'none', label: 'None' },
              ...dmgManeuvers.map((m) => ({
                value: m,
                disabled: !c.canDamageManeuver(m),
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Crystal filled={c.canDamageManeuver(m)} size={9} />
                    {MANEUVER_NAMES[m].replace(' Attack', '')}
                  </span>
                ),
              })),
            ]}
          />
        </div>
      )}

      {a.natural === 20 && (
        <div className="flex flex-col items-center gap-1.5">
          {!a.critical && <p className="text-xs text-mist">Natural 20 — critical cancelled</p>}
          <Button variant="secondary" size="sm" onClick={() => c.setCritical(!a.critical)}>
            {a.critical ? <ShieldOff className="size-4" /> : <Sparkles className="size-4" />}
            {a.critical ? "Can't be crit — cancel critical" : 'Restore critical hit'}
          </Button>
        </div>
      )}

      <Button variant="primary" size="xl" className="w-full" onClick={() => c.rollDamage(maneuver === 'none' ? undefined : maneuver)}>
        <Dices className="size-6" /> Roll Damage
      </Button>
      <div className="flex justify-center gap-5">
        <button type="button" onClick={c.markMiss} className="min-h-9 text-xs text-mist underline-offset-4 hover:text-bone hover:underline">
          Actually a miss
        </button>
        {a.natural !== 20 && (
          <button
            type="button"
            onClick={() => c.setCritical(!a.critical)}
            className="min-h-9 text-xs text-mist underline-offset-4 hover:text-bone hover:underline"
          >
            {a.critical ? 'Remove critical' : 'Mark as critical hit'}
          </button>
        )}
      </div>
    </div>
  );
}

function DamageStage({ c, a }: { c: Companion; a: AttackRecord }) {
  const damage = a.damage!;
  const [reducedToZero, setReducedToZero] = useState(false);
  const canTriggerHew = hewApplies(c.config, getWeapon(c.config, a.weaponId));
  const showHew = canTriggerHew && (a.critical || reducedToZero);
  return (
    <div className="space-y-3 sm:space-y-5">
      {a.critical && <p className="label-caps text-center text-delerium">Critical Hit</p>}
      <div className="space-y-4 max-sm:flex max-sm:items-center max-sm:justify-center max-sm:gap-6 max-sm:space-y-0">
        <BigNumber id={a.id} value={damage.total} label="damage" tone={a.critical ? 'crit' : 'violet'} />
        <DamageTypeChips damage={damage} large stacked />
      </div>
      {a.maneuver && a.maneuver !== 'precision' && (
        <p className="text-center text-xs text-octarine-soft">{MANEUVER_NAMES[a.maneuver]}</p>
      )}
      {/* Follow-up actions before the effect text, so they stay in view on a short phone screen. */}
      {canTriggerHew && !a.critical && (
        <div className="flex justify-center">
          <Toggle checked={reducedToZero} onChange={setReducedToZero}>
            Target reduced to 0 HP
          </Toggle>
        </div>
      )}
      {(c.canCleave || showHew) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {c.canCleave && (
            <Button variant="magic" size="lg" className="max-sm:min-h-12" onClick={c.cleave}>
              <Swords className="size-5" /> Cleave — attack 2nd target
            </Button>
          )}
          {showHew && (
            <Button variant="magic" size="lg" className="max-sm:min-h-12" onClick={c.hew} disabled={!c.hasActionFor('bonus')}>
              <Skull className="size-5" /> {c.hasActionFor('bonus') ? 'Hew — bonus attack' : 'Hew — bonus action used'}
            </Button>
          )}
        </div>
      )}
      <EffectList effects={a.effects} />
      <Details summary={`${a.total} to hit · ${attackCalc(a)}`}>
        <DamageDetails damage={damage} />
      </Details>
    </div>
  );
}

function MissStage({ c, a }: { c: Companion; a: AttackRecord }) {
  const graze = a.damage;
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="text-center">
        <p className="animate-rise font-display text-4xl font-bold tracking-[0.12em] text-mist uppercase sm:text-5xl">Miss</p>
        <D20Calc a={a} prefix={a.natural === 1 && !a.natural1Ignored ? 'Natural 1 · ' : `${a.total} to hit · `} />
      </div>
      {graze ? (
        <BigNumber id={`${a.id}-graze`} value={graze.total} label={`${typeName(graze.byType[0].type)} — ${graze.label}`} />
      ) : (
        <p className="py-4 text-center text-sm text-mist">No damage.</p>
      )}
      <PrecisionButton c={c} a={a} />
      {a.natural === 1 && !a.natural1Ignored ? (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={c.ignoreNatural1}>
            <Undo2 className="size-4" /> Ignore natural 1 — count the roll as normal
          </Button>
        </div>
      ) : (
        <div className="text-center">
          <button type="button" onClick={c.markHit} className="min-h-9 text-xs text-mist underline-offset-4 hover:text-bone hover:underline">
            Actually a hit
          </button>
        </div>
      )}
    </div>
  );
}

function Details({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-white/6 bg-abyss/40">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3.5 text-xs text-mist hover:text-bone">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        <span className="font-mono">{summary}</span>
        <span className="ml-auto">Dice</span>
      </summary>
      <div className="border-t border-white/6 px-3.5 py-3">{children}</div>
    </details>
  );
}

export function PrimaryActions({ c }: { c: Companion }) {
  const { phase } = c;
  if (phase === 'rolled' || phase === 'hit') return null;
  const next = phase !== 'ready';
  const ripostePossible = c.config.superiority.maneuvers.includes('riposte') && isMeleeAttack(c.weapon, c.situation);
  const surge = !c.canRoll && c.source === 'action' && c.canActionSurge;
  return (
    <div className="space-y-2">
      {c.combat.turn.override && (
        <p className="text-center text-xs text-ember">Override on — turn limits ignored until the next turn</p>
      )}
      {surge && (
        <Button variant="magic" size="lg" className="w-full" onClick={c.actionSurge}>
          <Zap className="size-5" /> Action Surge
          <span className="text-xs opacity-75">
            +{c.config.attacksPerAction} attacks · {c.combat.actionSurge}/{c.config.actionSurge.uses}
          </span>
        </Button>
      )}
      <div className="flex gap-2">
        {c.canRoll ? (
          <Button variant="primary" size="xl" className="flex-1" onClick={c.rollToHit}>
            {next ? <RotateCcw className="size-5" /> : <Sparkles className="size-5" />}
            {next ? 'Next Attack' : 'Roll to Hit'}
          </Button>
        ) : (
          <Button variant={surge ? 'secondary' : 'primary'} size="xl" className="flex-1" onClick={c.newTurn}>
            <Flag className="size-5" /> New Turn
          </Button>
        )}
        {ripostePossible && (
          <Button
            variant="magic"
            size="lg"
            className="min-h-16 px-3.5 sm:px-5"
            onClick={c.riposte}
            disabled={!c.canRiposte}
            title={
              c.hasActionFor('riposte')
                ? 'Reaction when a creature misses you with a melee attack. Spends a superiority die. No GWM bonus.'
                : 'Reaction already used this round'
            }
          >
            <Crystal filled={c.canRiposte} size={11} />
            Riposte
          </Button>
        )}
      </div>
    </div>
  );
}
