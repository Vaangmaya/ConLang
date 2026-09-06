// Project page (DESIGN.md §5.5): name, save/load/import, reset, frequency report.
// The colophon — quiet and administrative, the page a book ends on.

import { useRef } from 'react';
import { serializeProject } from '../../core/project';
import { frequencyReport } from '../../core/stats';
import { downloadTextFile } from '../download';
import { useWorkbenchStore } from '../state/store';

export function ProjectPage(): JSX.Element {
  const project = useWorkbenchStore((s) => s.project);
  const importErrors = useWorkbenchStore((s) => s.importErrors);
  const setProjectName = useWorkbenchStore((s) => s.setProjectName);
  const loadProject = useWorkbenchStore((s) => s.loadProject);
  const resetProject = useWorkbenchStore((s) => s.resetProject);
  const clearImportErrors = useWorkbenchStore((s) => s.clearImportErrors);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSave(): void {
    downloadTextFile(
      `${project.name || 'project'}.json`,
      serializeProject(project),
      'application/json',
    );
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadProject(JSON.parse(String(reader.result)));
      } catch {
        loadProject({});
      }
    };
    reader.readAsText(file);
  }

  function handleReset(): void {
    if (window.confirm('Reset the project? This discards all unsaved work.')) {
      resetProject();
    }
  }

  const frequencies = frequencyReport(project.lexicon, project.inventory);

  return (
    <section aria-label="Project" className="colophon">
      <h2>Project</h2>

      <label>
        Name:{' '}
        <input
          type="text"
          value={project.name}
          onChange={(e) => setProjectName(e.target.value)}
          style={{ width: '16rem' }}
        />
      </label>

      <div style={{ margin: '0.5rem 0' }}>
        <button type="button" onClick={handleSave}>
          Save (download JSON)
        </button>
        <button
          type="button"
          style={{ marginLeft: '0.5rem' }}
          onClick={() => fileInputRef.current?.click()}
        >
          Load / import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleFileChosen}
        />
        <button type="button" style={{ marginLeft: '0.5rem' }} onClick={handleReset}>
          Reset
        </button>
      </div>

      {importErrors && (
        <div className="warning-banner" role="alert">
          <strong>
            Couldn't load project — the file doesn't match the expected format:
          </strong>
          <ul>
            {importErrors.map((err, i) => (
              <li key={i}>
                {err.path || '(root)'}: {err.message}
              </li>
            ))}
          </ul>
          <button type="button" onClick={clearImportErrors}>
            Dismiss
          </button>
        </div>
      )}

      <h3>Frequency report</h3>
      {frequencies.length === 0 ? (
        <p>Add phonemes on the Inventory page to see a frequency report.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Phoneme</th>
              <th>Configured</th>
              <th>Observed</th>
            </tr>
          </thead>
          <tbody>
            {frequencies.map((f) => (
              <tr key={f.phonemeId}>
                <td className="ipa">{f.phonemeId}</td>
                <td className="mono-num">{(f.configured * 100).toFixed(1)}%</td>
                <td className="mono-num">{(f.observed * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
