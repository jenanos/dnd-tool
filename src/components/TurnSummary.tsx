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

/** Running total for the DM: every to-hit this turn plus one combined damage figure by type. */
export function TurnSummary({ c }: { c: Companion }) {
  const t = c.turnSummary;
  // A single attack is already on screen in full; the summary earns its space from the second one.
  if (t.attacks.length === 0 || (t.attacks.length === 1 && c.phase !== 'ready')) return null;
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
