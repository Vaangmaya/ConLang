// Lexicon page (DESIGN.md §5.3): generate N words, sortable table, reroll,
// delete, export, unsatisfiability diagnostic banner.

import { useMemo, useState } from 'react';
import { exportLexiconCsv, exportLexiconJson } from '../../core/project';
import { render } from '../../core/romanization';
import { downloadTextFile } from '../download';
import { randomSeed, useWorkbenchStore } from '../state/store';

const MAX_WORDS = 5000;

type SortColumn = 'ipa' | 'romanization' | 'syllables';
type SortDirection = 'asc' | 'desc';

export function LexiconPage(): JSX.Element {
  const project = useWorkbenchStore((s) => s.project);
  const lexiconDiagnostics = useWorkbenchStore((s) => s.lexiconDiagnostics);
  const lexiconError = useWorkbenchStore((s) => s.lexiconError);
  const generateLexicon = useWorkbenchStore((s) => s.generateLexicon);
  const rerollWord = useWorkbenchStore((s) => s.rerollWord);
  const deleteWord = useWorkbenchStore((s) => s.deleteWord);

  const [n, setN] = useState(100);
  const [seed, setSeed] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>('ipa');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const rows = useMemo(
    () =>
      project.lexicon.map((word, index) => ({
        index,
        ipa: word.phonemeIds
          .map((id) => project.inventory.phonemes.find((p) => p.id === id)?.ipa ?? id)
          .join(''),
        romanization: render(word.phonemeIds, project.inventory),
        syllables: word.syllableBreaks.length,
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

  return (
    <section aria-label="Lexicon">
      <h2>Lexicon</h2>

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

      <div style={{ margin: '0.5rem 0' }}>
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
      </div>

      <table>
        <thead>
          <tr>
            <th>
              <button type="button" onClick={() => handleSort('ipa')}>
                IPA {sortColumn === 'ipa' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </button>
            </th>
            <th>
              <button type="button" onClick={() => handleSort('romanization')}>
                Romanization{' '}
                {sortColumn === 'romanization'
                  ? sortDirection === 'asc'
                    ? '▲'
                    : '▼'
                  : ''}
              </button>
            </th>
            <th>
              <button type="button" onClick={() => handleSort('syllables')}>
                Syllables{' '}
                {sortColumn === 'syllables' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </button>
            </th>
            <th>&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.index}>
              <td className="ipa">{row.ipa}</td>
              <td>{row.romanization}</td>
              <td>{row.syllables}</td>
              <td>
                <button type="button" onClick={() => rerollWord(row.index, randomSeed())}>
                  Reroll
                </button>
                <button
                  type="button"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={() => deleteWord(row.index)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{project.lexicon.length} word(s)</p>
    </section>
  );
}
