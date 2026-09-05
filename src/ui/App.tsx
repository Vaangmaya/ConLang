import { useState } from 'react';
import { InventoryPage } from './pages/InventoryPage';
import { LexiconPage } from './pages/LexiconPage';
import { PhonotacticsPage } from './pages/PhonotacticsPage';
import { ProjectPage } from './pages/ProjectPage';
import { SoundChangesPage } from './pages/SoundChangesPage';

const TABS = [
  { id: 'inventory', label: 'Inventory', Page: InventoryPage },
  { id: 'phonotactics', label: 'Phonotactics', Page: PhonotacticsPage },
  { id: 'lexicon', label: 'Lexicon', Page: LexiconPage },
  { id: 'sound-changes', label: 'Sound Changes', Page: SoundChangesPage },
  { id: 'project', label: 'Project', Page: ProjectPage },
] as const;

export function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('inventory');
  const ActivePage = TABS.find((t) => t.id === activeTab)!.Page;

  return (
    <main>
      <h1>Conlang Workbench</h1>
      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={activeTab === tab.id}
            style={{
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              background: activeTab === tab.id ? '#dbe9ff' : undefined,
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <ActivePage />
    </main>
  );
}
