import { InventoryPage } from './pages/InventoryPage';
import { LandingPage } from './pages/LandingPage';
import { LearnPage } from './pages/LearnPage';
import { LexiconPage } from './pages/LexiconPage';
import { PhonotacticsPage } from './pages/PhonotacticsPage';
import { ProjectPage } from './pages/ProjectPage';
import { SoundChangesPage } from './pages/SoundChangesPage';
import { useWorkbenchStore, type View } from './state/store';

// The four names after 'Home' / 'Learn' are pinned by App.acceptance.test.tsx —
// they must stay <button>s with these exact accessible names.
const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'learn', label: 'Learn' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'phonotactics', label: 'Phonotactics' },
  { id: 'lexicon', label: 'Lexicon' },
  { id: 'sound-changes', label: 'Sound Changes' },
  { id: 'project', label: 'Project' },
] as const satisfies ReadonlyArray<{ id: View; label: string }>;

const PAGES: Record<Exclude<View, 'home'>, () => JSX.Element> = {
  learn: LearnPage,
  inventory: InventoryPage,
  phonotactics: PhonotacticsPage,
  lexicon: LexiconPage,
  'sound-changes': SoundChangesPage,
  project: ProjectPage,
};

export function App(): JSX.Element {
  const view = useWorkbenchStore((s) => s.view);
  const setView = useWorkbenchStore((s) => s.setView);

  if (view === 'home') {
    return <LandingPage />;
  }

  const ActivePage = PAGES[view];

  return (
    <main>
      <header className="app-head">
        <button type="button" className="app-wordmark" onClick={() => setView('home')}>
          Conlang Workbench
        </button>
        <nav className="app-nav" aria-label="Sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                item.id === 'home' || item.id === 'learn' ? 'app-nav-aux' : 'app-nav-tab'
              }
              aria-current={view === item.id}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <ActivePage />
    </main>
  );
}
