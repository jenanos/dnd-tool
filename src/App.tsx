import { AttackCard } from './components/AttackCard';
import { Header } from './components/Header';
import { HistoryPanel } from './components/HistoryPanel';
import { GwfPanel, SuperiorityPanel, TurnPanel } from './components/SidePanels';
import { CrystalDefs } from './components/ui';
import { WeaponSelector } from './components/WeaponSelector';
import { useCompanion } from './state/useCompanion';

export default function App() {
  const c = useCompanion();
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 sm:px-6 sm:pt-6">
      <CrystalDefs />
      <Header c={c} />
      <WeaponSelector c={c} />
      <main className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
