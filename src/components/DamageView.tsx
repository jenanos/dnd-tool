import { Shield, Sparkles, Swords, Zap } from 'lucide-react';
import type { DamageResult, Effect } from '../rules/types';
import { damageLine, flatBreakdown, typeName } from './format';
import { cx, DAMAGE_BORDERS, DAMAGE_COLORS } from './ui';

export function DamageTypeChips({ damage, large = false }: { damage: DamageResult; large?: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {damage.byType.map(({ type, amount }) => (
        <div
          key={type}
          className={cx(
            'flex items-baseline gap-2 rounded-xl border px-4 py-2',
            DAMAGE_BORDERS[type] ?? 'border-white/10 bg-white/[0.04]',
            large && 'px-5 py-2.5',
          )}
        >
          <span className={cx('font-display font-bold tabular-nums', large ? 'text-3xl' : 'text-xl', DAMAGE_COLORS[type])}>
            {amount}
          </span>
          <span className={cx('label-caps', DAMAGE_COLORS[type] ?? 'text-mist', 'opacity-80')}>{typeName(type)}</span>
        </div>
      ))}
    </div>
  );
}

/** Auditable breakdown: every die, every reroll/adjustment and every flat modifier. */
export function DamageDetails({ damage }: { damage: DamageResult }) {
  return (
    <div className="space-y-1.5 text-left text-sm">
      {damage.byType.map(({ type, amount }) => (
        <div key={type} className="flex gap-3">
          <span className={cx('w-20 shrink-0 font-medium', DAMAGE_COLORS[type] ?? 'text-bone')}>{typeName(type)}</span>
          <span className="flex-1 font-mono text-[0.8rem] text-bone/85">{damageLine(damage, type)}</span>
          <span className="font-mono text-[0.8rem] text-mist tabular-nums">= {amount}</span>
        </div>
      ))}
      {damage.flats.length > 0 && <p className="pt-1 text-xs text-mist">{flatBreakdown(damage)}</p>}
      <p className="text-xs text-mist">
        {[
          damage.critical && 'Critical: damage dice doubled',
          damage.gwfMode &&
            (damage.gwfMode === '2024' ? 'GWF 2024: 1–2 counted as 3' : 'GWF 2014: 1–2 rerolled once'),
          damage.terms.length > 0 && !damage.gwfMode && 'No Great Weapon Fighting',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}

const EFFECT_STYLE: Record<Effect['tone'], { className: string; Icon: typeof Shield }> = {
  save: { className: 'border-delerium/35 bg-delerium/10 text-delerium', Icon: Shield },
  mastery: { className: 'border-octarine/35 bg-octarine/10 text-octarine-soft', Icon: Swords },
  feature: { className: 'border-frost/35 bg-frost/10 text-frost', Icon: Zap },
  info: { className: 'border-white/10 bg-white/[0.04] text-bone/85', Icon: Sparkles },
};

export function EffectList({ effects }: { effects: Effect[] }) {
  if (!effects.length) return null;
  return (
    <ul className="space-y-2">
      {effects.map((e) => {
        const { className, Icon } = EFFECT_STYLE[e.tone];
        return (
          <li key={e.text} className={cx('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm', className)}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span>{e.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
