import { Flag, Gem, ScrollText, Swords } from 'lucide-react';
import { cx } from './ui';

export type Tab = 'attack' | 'turn' | 'resources' | 'log';

const TABS: { id: Tab; label: string; Icon: typeof Swords }[] = [
  { id: 'attack', label: 'Attack', Icon: Swords },
  { id: 'turn', label: 'Turn', Icon: Flag },
  { id: 'resources', label: 'Resources', Icon: Gem },
  { id: 'log', label: 'Log', Icon: ScrollText },
];

export const tabPanelId = (tab: Tab) => `tab-panel-${tab}`;

/** Bottom navigation for the phone layout. */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav
      role="tablist"
      aria-label="Sections"
      className="grid shrink-0 grid-cols-4 border-t border-white/8 bg-abyss/85 px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = id === tab;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={tabPanelId(id)}
            onClick={() => onChange(id)}
            className={cx(
              'flex min-h-14 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition-colors',
              active ? 'text-octarine-soft' : 'text-mist hover:text-bone',
            )}
          >
            <span
              className={cx(
                'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                active && 'bg-plum shadow-[0_0_0_1px_rgb(167_121_255/0.45),0_0_18px_-6px_rgb(167_121_255/0.8)]',
              )}
            >
              <Icon className="size-[1.15rem]" />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
