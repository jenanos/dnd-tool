import { attackModifiers, formatBonus, sumModifiers, weaponDamageModifiers } from '../rules/character';
import type { Companion } from '../state/useCompanion';
import { cx, DAMAGE_COLORS } from './ui';

/** `compact`: one row of four on a phone, names only (the attack card shows the numbers). */
export function WeaponSelector({ c, compact = false }: { c: Companion; compact?: boolean }) {
  return (
    <nav aria-label="Weapon" className={cx('grid gap-2 sm:grid-cols-4', compact ? 'grid-cols-4 max-sm:gap-1.5' : 'grid-cols-2')}>
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
              'relative overflow-hidden rounded-xl border text-left transition',
              compact ? 'min-h-12 px-3 py-2 max-sm:px-1.5 max-sm:text-center' : 'min-h-16 px-3 py-2.5',
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
            <span
              className={cx(
                'relative block font-display font-semibold sm:truncate sm:text-sm',
                compact ? 'text-[0.68rem] leading-tight max-sm:line-clamp-2' : 'truncate text-[0.8rem]',
                active ? 'text-bone' : 'text-bone/75',
              )}
            >
              {w.shortName ?? w.name}
            </span>
            <span className={cx('relative mt-0.5 block truncate text-xs text-mist tabular-nums', compact && 'max-sm:hidden')}>
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
