import { ChevronRight } from 'lucide-react';
import { phaseOf } from '../rules/combat';
import type { AttackRecord } from '../rules/types';
import type { Companion } from '../state/useCompanion';
import { typeName } from './format';
import { cx, DAMAGE_COLORS } from './ui';

function attackLabel(a: AttackRecord) {
  if (a.attackNumber) return `Attack ${a.attackNumber}`;
  return a.source === 'bonus' ? 'Bonus' : a.source === 'cleave' ? 'Cleave' : 'Attack';
}

function result(a: AttackRecord) {
  switch (phaseOf(a)) {
    case 'rolled':
      return <span className="text-mist">awaiting call</span>;
    case 'hit':
      return <span className="text-mist">{a.critical ? 'Crit' : 'Hit'} — roll damage</span>;
    case 'miss':
      return a.damage ? (
        <span className="text-bone/90">
          Miss · <b className="tabular-nums">{a.damage.total}</b> {a.damage.label}
        </span>
      ) : (
        <span className="text-mist">Miss</span>
      );
    case 'damage':
      return (
        <span className={a.critical ? 'text-delerium' : 'text-bone/90'}>
          {a.critical ? 'Crit' : 'Hit'} · <b className="tabular-nums">{a.damage!.total}</b>
        </span>
      );
    default:
      return null;
  }
}

// A single attack is already on screen in full; the summary earns its space from the second one.
const worthShowing = (c: Companion) => c.turnSummary.attacks.length > 1 || (c.turnSummary.attacks.length === 1 && c.phase === 'ready');

/** Running total for the DM: every to-hit this turn plus one combined damage figure by type. */
export function TurnSummary({ c, always = false }: { c: Companion; always?: boolean }) {
  const t = c.turnSummary;
  if (always && t.attacks.length === 0) {
    return (
      <section aria-label="This turn" className="rounded-xl border border-octarine/25 bg-abyss/50 px-4 py-3">
        <h3 className="label-caps text-octarine-soft">This turn</h3>
        <p className="py-3 text-center text-sm text-mist">No attacks this turn yet.</p>
      </section>
    );
  }
  if (!always && !worthShowing(c)) return null;
  return (
    <section aria-label="This turn" className="rounded-xl border border-octarine/25 bg-abyss/50 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="label-caps text-octarine-soft">This turn</h3>
        <p>
          <span className="font-display text-2xl font-bold text-bone tabular-nums">{t.total}</span>
          <span className="label-caps ml-2 text-mist">damage</span>
        </p>
      </div>
      <ol className="mt-1.5 space-y-1 text-sm">
        {t.attacks.map((a) => (
          <li
            key={a.id}
            className={cx('flex items-baseline gap-3', a.id === c.combat.currentId ? 'text-bone' : 'text-bone/85')}
          >
            <span className="w-16 shrink-0 text-xs text-mist">{attackLabel(a)}</span>
            <span className="tabular-nums">
              <b>{a.total}</b> <span className="text-xs text-mist">to hit</span>
            </span>
            <span className="ml-auto text-right">{result(a)}</span>
          </li>
        ))}
      </ol>
      {t.byType.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-4 border-t border-white/8 pt-2 text-sm">
          {t.byType.map(({ type, amount }) => (
            <span key={type} className={DAMAGE_COLORS[type] ?? 'text-bone'}>
              <b className="tabular-nums">{amount}</b> {typeName(type)}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

/** One-line version of the turn summary for the phone action bar; opens the full one. */
export function TurnStrip({ c, onOpen }: { c: Companion; onOpen: () => void }) {
  const t = c.turnSummary;
  if (!worthShowing(c)) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`This turn: ${t.attacks.length} attacks, ${t.total} damage. Show details`}
      className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-octarine/25 bg-abyss/60 px-3.5 text-left hover:bg-abyss/80"
    >
      <span className="label-caps shrink-0 text-octarine-soft">This turn</span>
      <span className="shrink-0 text-xs text-mist tabular-nums">×{t.attacks.length}</span>
      <span className="min-w-0 flex-1 truncate text-right text-xs">
        {t.byType.map(({ type, amount }, i) => (
          <span key={type} className={DAMAGE_COLORS[type] ?? 'text-bone'}>
            {i > 0 && <span className="text-mist"> · </span>}
            <b className="tabular-nums">{amount}</b> {typeName(type)}
          </span>
        ))}
      </span>
      <span className="shrink-0 font-display text-xl font-bold text-bone tabular-nums">{t.total}</span>
      <ChevronRight className="size-4 shrink-0 text-mist" />
    </button>
  );
}
