import { formatDie } from '../rules/dice';
import { capitalize, formatBonus, sumModifiers } from '../rules/character';
import type { AttackRecord, DamageResult, DamageType } from '../rules/types';

export function attackNumberLabel(n: number, perAction: number) {
  const within = ((n - 1) % perAction) + 1;
  const surge = n > perAction ? ' · Action Surge' : '';
  return `Attack ${within} / ${perAction}${surge}`;
}

const signed = (n: number) => `${n < 0 ? '−' : '+'} ${Math.abs(n)}`;

/** Everything after the d20, e.g. "+ 10 + d8 (6) Precision". */
export function attackBonusText(a: AttackRecord) {
  let s = signed(sumModifiers(a.attackModifiers));
  if (a.precision) s += ` + d${a.precision.sides} (${a.precision.value}) Precision`;
  return s;
}

/** e.g. "d20 (14) + 10" or "d20 (3, 15) + 10 + d8 (6) Precision". */
export const attackCalc = (a: AttackRecord) => `d20 (${a.d20.join(', ')}) ${attackBonusText(a)}`;

/** One line per damage type, e.g. "2d6 (1→3, 5) + 1d8 Trip Attack (4) + 10". */
export function damageLine(d: DamageResult, type: DamageType) {
  const dice = d.terms
    .filter((t) => t.type === type)
    .map((t) => `${t.count}d${t.sides}${t === d.terms[0] ? '' : ` ${t.label}`} (${t.dice.map(formatDie).join(', ')})`)
    .join(' + ');
  const flat = d.flats.filter((f) => f.type === type).reduce((n, f) => n + sumModifiers(f.modifiers), 0);
  if (!flat) return dice;
  return dice ? `${dice} ${signed(flat)}` : String(flat);
}

export function flatBreakdown(d: DamageResult) {
  return d.flats
    .map((f) => `${capitalize(f.type)} ${formatBonus(sumModifiers(f.modifiers))} = ${f.modifiers.map((m) => `${m.label} ${formatBonus(m.value)}`).join(', ')}`)
    .join(' · ');
}

export const typeName = capitalize;
