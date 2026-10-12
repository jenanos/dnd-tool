import { attackModifiers, formatBonus, sumModifiers, weaponDamageModifiers } from '../rules/character';
import type { Companion } from '../state/useCompanion';
import { cx, DAMAGE_COLORS } from './ui';

export function WeaponSelector({ c }: { c: Companion }) {
  return (
    <nav aria-label="Weapon" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {c.config.weapons.map((w) => {
        const active = w.id === c.weapon.id;
        const flat = sumModifiers(weaponDamageModifiers(c.config, w, { partOfAttackAction: true }));
        return (
          <button
            key={w.id}
            type="button"
            aria-pressed={active}
            onClick={() => c.selectWeapon(w.id)}
            className={cx(
              'relative min-h-16 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition',
              active
                ? 'border-octarine/60 bg-plum/70 glow-violet'
                : 'border-white/8 bg-ash/60 hover:border-white/20 hover:bg-ash',
            )}
          >
            {w.primary && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,rgb(132_216_245/0.16),transparent_60%)]"
              />
            )}
            <span className={cx('relative block truncate font-display text-[0.8rem] font-semibold sm:text-sm', active ? 'text-bone' : 'text-bone/75')}>
              {w.shortName ?? w.name}
            </span>
            <span className="relative mt-0.5 block truncate text-xs text-mist tabular-nums">
              {formatBonus(sumModifiers(attackModifiers(c.config, w)))} · {w.damage.count}d{w.damage.sides}
              {flat ? ` ${formatBonus(flat)}` : ''}
              {w.extraDamage
                ?.filter((e) => !e.when)
                .map((e) => (
                  <span key={e.label} className={DAMAGE_COLORS[e.type]}>
                    {' '}
                    + {e.count}d{e.sides}
                  </span>
                ))}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
