// Lexicon page (DESIGN.md §5.3): generate N words, sortable dictionary-style
// rows (virtualized for up to 5,000 entries), reroll, delete, export.

import { useMemo, useState } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { exportLexiconCsv, exportLexiconJson, lexiconToRows } from '../../core/project';
import { downloadTextFile } from '../download';
import { randomSeed, useWorkbenchStore } from '../state/store';

const MAX_WORDS = 5000;
const ROW_HEIGHT = 44;
const LIST_HEIGHT = 520;

type SortColumn = 'ipa' | 'romanization' | 'syllables';
type SortDirection = 'asc' | 'desc';

interface Row {
  index: number;
  ipa: string;
  romanization: string;
  syllables: number;
}

interface RowData {
  rows: Row[];
  onReroll: (index: number) => void;
  onDelete: (index: number) => void;
}

function LexiconRow({
  index,
  style,
  data,
}: ListChildComponentProps<RowData>): JSX.Element {
  const row = data.rows[index]!;
  return (
    <div className="lexicon-row" style={style}>
      <span className="ipa lexicon-headword">{row.romanization}</span>
      <span className="ipa lexicon-pron">/{row.ipa}/</span>
      <span className="lexicon-syllables">
        {row.syllables} syll{row.syllables === 1 ? '' : '.'}
      </span>
      <span className="lexicon-actions">
        <button type="button" onClick={() => data.onReroll(row.index)}>
          Reroll
        </button>
        <button type="button" onClick={() => data.onDelete(row.index)}>
          Delete
        </button>
      </span>
    </div>
  );
}

function sortIndicator(active: boolean, direction: SortDirection): string {
  if (!active) return '';
  return direction === 'asc' ? ' ▲' : ' ▼';
}

export function LexiconPage(): JSX.Element {
  const project = useWorkbenchStore((s) => s.project);
  const lexiconDiagnostics = useWorkbenchStore((s) => s.lexiconDiagnostics);
  const lexiconError = useWorkbenchStore((s) => s.lexiconError);
  const generateLexicon = useWorkbenchStore((s) => s.generateLexicon);
  const rerollWord = useWorkbenchStore((s) => s.rerollWord);
  const deleteWord = useWorkbenchStore((s) => s.deleteWord);

  const [n, setN] = useState(100);
  const [seed, setSeed] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>('romanization');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const rows: Row[] = useMemo(
    () =>
      lexiconToRows(project.lexicon, project.inventory).map((row, index) => ({
        index,
        ipa: row.ipa,
        romanization: row.romanized,
        syllables: row.syllables,
      })),
    [project.lexicon, project.inventory],
  );

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortColumn];
      const bv = b[sortColumn];
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortColumn, sortDirection]);

  function handleSort(column: SortColumn): void {
    if (column === sortColumn) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function handleGenerate(): void {
    generateLexicon(Math.min(Math.max(1, Math.floor(n)), MAX_WORDS), seed);
  }

  const rowData: RowData = {
    rows: sortedRows,
    onReroll: (index) => rerollWord(index, randomSeed()),
    onDelete: (index) => deleteWord(index),
  };

  return (
    <section aria-label="Lexicon">
      <h2>Lexicon</h2>

      <div className="lexicon-controls">
        <label>
          Words to generate:{' '}
          <input
            type="number"
            min={1}
            max={MAX_WORDS}
            value={n}
            onChange={(e) => setN(Number(e.target.value) || 1)}
            style={{ width: '6rem' }}
          />
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Seed:{' '}
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: '8rem' }}
          />
        </label>
        <button type="button" style={{ marginLeft: '1rem' }} onClick={handleGenerate}>
          Generate
        </button>
        <button
          type="button"
          style={{ marginLeft: '0.5rem' }}
          onClick={() => setSeed(randomSeed())}
        >
          Random seed
        </button>
      </div>

      {lexiconError && (
        <div className="warning-banner" role="alert">
          Couldn't generate: {lexiconError}
        </div>
      )}
      {lexiconDiagnostics && lexiconDiagnostics.rejectedWords > 0 && (
        <div className="warning-banner" role="alert">
          Your grammar looks unsatisfiable — {lexiconDiagnostics.rejectedWords} word(s)
          couldn't be generated within the attempt limit.
          <ul>
            {lexiconDiagnostics.topRejectingConstraints.map((t, i) => (
              <li key={i}>
                {t.constraint}: {t.rejections} rejections
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.lexicon.length === 0 ? (
        <p>No words yet — set a count and seed above, then Generate.</p>
      ) : (
        <>
          <div className="lexicon-controls" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  'lexicon.csv',
                  exportLexiconCsv(project.lexicon, project.inventory),
                  'text/csv',
                )
              }
            >
              Export CSV
            </button>
            <button
              type="button"
              style={{ marginLeft: '0.5rem' }}
              onClick={() =>
                downloadTextFile(
                  'lexicon.json',
                  exportLexiconJson(project.lexicon, project.inventory),
                  'application/json',
                )
              }
            >
              Export JSON
            </button>
            <span className="lexicon-count">{project.lexicon.length} word(s)</span>
          </div>

          <div className="lexicon-grid-row lexicon-header">
            <button type="button" onClick={() => handleSort('romanization')}>
              Romanization{sortIndicator(sortColumn === 'romanization', sortDirection)}
            </button>
            <button type="button" onClick={() => handleSort('ipa')}>
              IPA{sortIndicator(sortColumn === 'ipa', sortDirection)}
            </button>
            <button type="button" onClick={() => handleSort('syllables')}>
              Syllables{sortIndicator(sortColumn === 'syllables', sortDirection)}
            </button>
            <span>&nbsp;</span>
          </div>

          <FixedSizeList
            height={LIST_HEIGHT}
            width="100%"
            itemCount={sortedRows.length}
            itemSize={ROW_HEIGHT}
            itemData={rowData}
            className="lexicon-list"
          >
            {LexiconRow}
          </FixedSizeList>
        </>
      )}
    </section>
  );
}
