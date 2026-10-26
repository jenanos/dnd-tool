import { useEffect, useRef, useState } from 'react';
import { AttackCard, PrimaryActions } from './components/AttackCard';
import { Header } from './components/Header';
import { HistoryPanel } from './components/HistoryPanel';
import { GwfPanel, SuperiorityPanel, TurnPanel } from './components/SidePanels';
import { type Tab, TabBar, tabPanelId } from './components/TabBar';
import { TurnStrip, TurnSummary } from './components/TurnSummary';
import { CrystalDefs } from './components/ui';
import { WeaponSelector } from './components/WeaponSelector';
import { type Companion, useCompanion } from './state/useCompanion';
import { useMediaQuery } from './state/useMediaQuery';

export default function App() {
  const c = useCompanion();
  // Tailwind's `lg` breakpoint: side-by-side panels fit from here on.
  const wide = useMediaQuery('(min-width: 64rem)');
  return (
    <>
      <CrystalDefs />
      {wide ? <WideLayout c={c} /> : <PhoneLayout c={c} />}
    </>
  );
}

function WideLayout({ c }: { c: Companion }) {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-6 pt-6 pb-10">
      <Header c={c} />
      <WeaponSelector c={c} />
      <main className="grid grid-cols-[minmax(0,1fr)_22rem] gap-4">
        <AttackCard c={c} />
        <aside className="space-y-4">
          <SuperiorityPanel c={c} />
          <GwfPanel c={c} />
          <TurnPanel c={c} />
          <HistoryPanel c={c} />
        </aside>
      </main>
    </div>
  );
}

/**
 * One screen, no page scroll: the attack flow sits between a fixed header and a pinned action
 * bar, and everything else lives behind the bottom tabs.
 */
function PhoneLayout({ c }: { c: Companion }) {
  const [tab, setTab] = useState<Tab>('attack');
  const scroller = useRef<HTMLDivElement>(null);
  // Each step of an attack starts from the top of the card, where its result is.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [c.phase, c.combat.currentId]);
  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col">
      <div className="shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:px-6">
        <Header c={c} />
      </div>

      {tab === 'attack' ? (
        <div id={tabPanelId('attack')} role="tabpanel" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-4 pt-1 pb-3 sm:px-6">
            <WeaponSelector c={c} compact />
          </div>
          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 sm:px-6">
            <AttackCard c={c} compact />
          </div>
          <div className="shrink-0 space-y-2 px-4 pt-1 pb-3 empty:hidden sm:px-6">
            <TurnStrip c={c} onOpen={() => setTab('turn')} />
            <PrimaryActions c={c} />
          </div>
        </div>
      ) : (
        <div
          key={tab}
          id={tabPanelId(tab)}
          role="tabpanel"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pt-1 pb-4 sm:px-6"
        >
          {tab === 'turn' && (
            <>
              <TurnSummary c={c} always />
              <TurnPanel c={c} />
            </>
          )}
          {tab === 'resources' && (
            <>
              <SuperiorityPanel c={c} />
              <GwfPanel c={c} />
            </>
          )}
          {tab === 'log' && <HistoryPanel c={c} />}
        </div>
      )}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}
