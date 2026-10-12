import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { DamageType } from '../rules/types';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-white/8 bg-abyss/70 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex-1 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-35',
              size === 'sm' ? 'min-h-9 px-2.5 text-xs' : 'min-h-11 px-3 text-sm',
              active
                ? 'bg-plum text-octarine-soft shadow-[0_0_0_1px_rgb(167_121_255/0.45),0_0_18px_-6px_rgb(167_121_255/0.8)]'
                : 'text-mist hover:text-bone',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  children,
  tone = 'violet',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  tone?: 'violet' | 'warn';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors',
        checked
          ? tone === 'warn'
            ? 'border-ember/50 bg-ember/12 text-ember'
            : 'border-octarine/50 bg-octarine/15 text-octarine-soft'
          : 'border-white/10 text-mist hover:border-white/20 hover:text-bone',
      )}
    >
      <span
        className={cx(
          'size-2 rounded-full transition-colors',
          checked ? (tone === 'warn' ? 'bg-ember' : 'bg-octarine shadow-[0_0_8px_var(--color-octarine)]') : 'bg-white/20',
        )}
      />
      {children}
    </button>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'hit' | 'miss' | 'magic';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-[#b48cff] to-[#8452f0] text-white font-semibold glow-violet hover:brightness-110 active:brightness-95',
  secondary: 'border border-white/12 bg-white/[0.04] text-bone hover:bg-white/[0.08]',
  ghost: 'text-mist hover:text-bone hover:bg-white/[0.05]',
  hit: 'border border-delerium/40 bg-delerium/12 text-delerium font-semibold hover:bg-delerium/20',
  miss: 'border border-white/12 bg-white/[0.04] text-bone font-semibold hover:bg-white/[0.08]',
  magic: 'border border-octarine/45 bg-octarine/12 text-octarine-soft font-medium hover:bg-octarine/20',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl transition disabled:opacity-35 disabled:saturate-0',
        size === 'sm' && 'min-h-9 px-3 text-sm',
        size === 'md' && 'min-h-11 px-4 text-sm',
        size === 'lg' && 'min-h-14 px-5 text-base',
        size === 'xl' && 'min-h-16 px-4 font-display text-base tracking-[0.08em] whitespace-nowrap uppercase sm:px-6 sm:text-lg sm:tracking-[0.12em]',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

/** A Delerium-style crystal used for superiority dice. */
export function Crystal({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size * 1.35} viewBox="0 0 20 27" aria-hidden className="shrink-0">
      <path
        d="M10 1 L18 9 L10 26 L2 9 Z"
        fill={filled ? 'url(#crystal-fill)' : 'none'}
        stroke={filled ? '#d9c6ff' : 'rgb(255 255 255 / 0.22)'}
        strokeWidth="1.3"
        strokeLinejoin="round"
        style={filled ? { filter: 'drop-shadow(0 0 5px rgb(167 121 255 / 0.85))' } : undefined}
      />
      {filled && <path d="M2 9 H18 M10 1 L7 9 L10 26 L13 9 Z" fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth="0.8" />}
    </svg>
  );
}

/** Shared gradient for every Crystal (rendered once in App). */
export function CrystalDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id="crystal-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e6d9ff" />
          <stop offset="45%" stopColor="#a779ff" />
          <stop offset="100%" stopColor="#5b3aa8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const DAMAGE_COLORS: Partial<Record<DamageType, string>> = {
  slashing: 'text-bone',
  piercing: 'text-[#f3d7a1]',
  bludgeoning: 'text-[#d8c7b0]',
  cold: 'text-frost',
};

export const DAMAGE_BORDERS: Partial<Record<DamageType, string>> = {
  cold: 'border-frost/40 bg-frost/10 shadow-[0_0_24px_-10px_var(--color-frost)]',
};
