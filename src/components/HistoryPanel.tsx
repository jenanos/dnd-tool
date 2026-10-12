import { ScrollText, Trash2 } from 'lucide-react';
import { MANEUVER_NAMES } from '../rules/character';
import { getWeapon } from '../rules/character';
import { phaseOf } from '../rules/combat';
import type { AttackRecord } from '../rules/types';
import type { Companion } from '../state/useCompanion';
import { DamageDetails, EffectList } from './DamageView';
import { attackCalc, typeName } from './format';
import { Button, cx, DAMAGE_COLORS } from './ui';

const SOURCE_TAG: Partial<Record<AttackRecord['source'], string>> = {
  bonus: 'Bonus',
  reaction: 'Reaction',
  riposte: 'Riposte',
  cleave: 'Cleave',
};

function OutcomeBadge({ a }: { a: AttackRecord }) {
  const phase = phaseOf(a);
  const [label, className] =
    phase === 'miss'
      ? ['Miss', 'text-mist border-white/10']
      : a.critical
        ? ['Crit', 'text-delerium border-delerium/40']
        : phase === 'rolled'
          ? ['Rolled', 'text-mist border-white/10 border-dashed']
          : ['Hit', 'text-octarine-soft border-octarine/40'];
  return <span className={cx('label-caps rounded-md border px-1.5 py-0.5 text-[0.6rem]', className)}>{label}</span>;
}

export function HistoryPanel({ c }: { c: Companion }) {
  const entries = c.combat.history;
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="label-caps flex items-center gap-2 text-octarine-soft">
          <ScrollText className="size-4" /> Recent Attacks
        </h3>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={c.clearHistory} aria-label="Clear history">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-mist">No attacks yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((a) => (
            <HistoryEntry key={a.id} a={a} current={a.id === c.combat.currentId} c={c} />
          ))}
        </ol>
      )}
    </section>
  );
}

function HistoryEntry({ a, current, c }: { a: AttackRecord; current: boolean; c: Companion }) {
  const w = getWeapon(c.config, a.weaponId);
  const time = new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <li>
      <details className={cx('group rounded-xl border bg-abyss/40', current ? 'border-octarine/35' : 'border-white/6')}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-3 py-2 text-sm">
          <OutcomeBadge a={a} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-bone/90">
              {w.shortName ?? w.name}
              {SOURCE_TAG[a.source] && <span className="text-mist"> · {SOURCE_TAG[a.source]}</span>}
              {a.maneuver && a.maneuver !== 'riposte' && (
                <span className="text-octarine-soft"> · {MANEUVER_NAMES[a.maneuver].replace(' Attack', '')}</span>
              )}
            </span>
            <span className="block text-xs text-mist tabular-nums">
              {a.total} to hit · {time}
            </span>
          </span>
          {a.damage && (
            <span className="text-right">
              <span className="block font-display text-lg leading-tight font-bold text-bone tabular-nums">{a.damage.total}</span>
              <span className="block text-[0.7rem] text-mist">
                {a.damage.byType.map((t, i) => (
                  <span key={t.type} className={DAMAGE_COLORS[t.type]}>
                    {i > 0 && ' + '}
                    {t.amount} {typeName(t.type)}
                  </span>
                ))}
              </span>
            </span>
          )}
        </summary>
        <div className="space-y-3 border-t border-white/6 px-3 py-3">
          <p className="font-mono text-xs text-bone/85">
            To hit: {attackCalc(a)} = {a.total}
            {a.rollMode !== 'normal' && ` (${a.rollMode})`}
          </p>
          {a.rollModeNotes.length > 0 && <p className="text-xs text-ember">{a.rollModeNotes.join(' · ')}</p>}
          {a.damage && (
            <>
              {a.damage.label && <p className="text-xs text-octarine-soft">{a.damage.label}</p>}
              <DamageDetails damage={a.damage} />
            </>
          )}
          <EffectList effects={a.effects} />
          <p className="text-xs text-mist">
            Mastery: {c.config.masteries[a.mastery].name}
            {a.superiorityDiceSpent > 0 && ` · ${a.superiorityDiceSpent} superiority die spent`}
            {!a.partOfAttackAction && ' · not Attack action (no GWM)'}
          </p>
        </div>
      </details>
    </li>
  );
}
