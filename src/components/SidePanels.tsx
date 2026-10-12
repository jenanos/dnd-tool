import { Flag, Minus, Moon, Plus } from 'lucide-react';
import { maneuverSaveDc } from '../rules/character';
import type { GwfMode } from '../rules/types';
import type { Companion } from '../state/useCompanion';
import { Button, Crystal, Segmented } from './ui';

function PanelTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="label-caps text-octarine-soft">{children}</h3>
      {aside}
    </div>
  );
}

export function SuperiorityPanel({ c }: { c: Companion }) {
  const { count, die } = c.config.superiority;
  const n = c.combat.superiority;
  return (
    <section className="panel p-4">
      <PanelTitle aside={<span className="text-xs text-mist">d{die} · DC {maneuverSaveDc(c.config)}</span>}>
        Superiority Dice
      </PanelTitle>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" aria-label="Spend one die" onClick={() => c.adjustSuperiority(-1)} disabled={n === 0}>
          <Minus className="size-4" />
        </Button>
        <div className="flex flex-1 justify-center gap-1.5" aria-label={`${n} of ${count} remaining`}>
          {Array.from({ length: count }, (_, i) => (
            <Crystal key={i} filled={i < n} size={20} />
          ))}
        </div>
        <Button variant="secondary" size="sm" aria-label="Regain one die" onClick={() => c.adjustSuperiority(1)} disabled={n === count}>
          <Plus className="size-4" />
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={c.shortRest} disabled={n === count}>
        <Moon className="size-4" /> Short / Long Rest — restore all
      </Button>
    </section>
  );
}

export function GwfPanel({ c }: { c: Companion }) {
  return (
    <section className="panel p-4">
      <PanelTitle>Great Weapon Fighting</PanelTitle>
      <Segmented<GwfMode>
        label="Great Weapon Fighting rules"
        value={c.settings.gwfMode}
        onChange={c.setGwfMode}
        options={[
          { value: '2024', label: '2024 rules' },
          { value: '2014', label: '2014 rules' },
        ]}
      />
      <p className="mt-2.5 text-xs leading-relaxed text-mist">
        {c.settings.gwfMode === '2024'
          ? 'Damage dice showing 1 or 2 count as 3.'
          : 'Damage dice showing 1 or 2 are rerolled once; the new roll stands.'}{' '}
        {c.config.rules.houseRules.greatWeaponFightingAppliesToAllDamageDice &&
          'House rule: applies to every damage die of a two-handed melee attack, including Frost and superiority dice.'}
      </p>
    </section>
  );
}

export function TurnPanel({ c }: { c: Companion }) {
  const { actionAttacks, cleaveUsed } = c.combat.turn;
  const per = c.config.attacksPerAction;
  const showCleave = c.config.weapons.some((w) => w.mastery === 'cleave');
  return (
    <section className="panel p-4">
      <PanelTitle
        aside={
          <Button variant="ghost" size="sm" onClick={c.newTurn}>
            <Flag className="size-4" /> New turn
          </Button>
        }
      >
        Turn
      </PanelTitle>
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: Math.max(per, Math.ceil(actionAttacks / per) * per) }, (_, i) => (
            <span
              key={i}
              className={
                i < actionAttacks
                  ? 'h-2 w-6 rounded-full bg-octarine shadow-[0_0_8px_var(--color-octarine)]'
                  : 'h-2 w-6 rounded-full bg-white/12'
              }
            />
          ))}
        </div>
        <span className="text-sm text-bone/90">
          {actionAttacks === 0 ? 'No attacks yet' : `${actionAttacks} Attack-action ${actionAttacks === 1 ? 'attack' : 'attacks'}`}
        </span>
      </div>
      {showCleave && <p className="mt-2 text-xs text-mist">Cleave {cleaveUsed ? 'used this turn' : 'available this turn'}</p>}
    </section>
  );
}
