import { Undo2 } from 'lucide-react';
import type { Companion } from '../state/useCompanion';
import { Button, Crystal } from './ui';

export function Header({ c }: { c: Companion }) {
  const { character, superiority } = c.config;
  return (
    <header className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-lg font-bold tracking-wide text-bone sm:text-2xl">{character.name}</h1>
        <p className="truncate text-xs text-mist sm:text-sm">
          {character.className} {character.level} · {character.subclass}
          <span className="hidden sm:inline"> · {character.campaign}</span>
        </p>
      </div>

      <div
        className="flex items-center gap-2 rounded-full border border-white/8 bg-abyss/60 py-1.5 pr-3 pl-2.5"
        title={`${c.combat.superiority} of ${superiority.count} superiority dice (d${superiority.die})`}
      >
        <div className="flex gap-0.5">
          {Array.from({ length: superiority.count }, (_, i) => (
            <Crystal key={i} filled={i < c.combat.superiority} size={12} />
          ))}
        </div>
        <span className="font-display text-sm font-semibold text-octarine-soft tabular-nums">{c.combat.superiority}</span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={c.undo}
        disabled={!c.undoLabel}
        title={c.undoLabel ? `Undo ${c.undoLabel}` : 'Nothing to undo'}
        aria-label={c.undoLabel ? `Undo ${c.undoLabel}` : 'Undo'}
      >
        <Undo2 className="size-4" />
        <span className="hidden sm:inline">Undo</span>
      </Button>
    </header>
  );
}
