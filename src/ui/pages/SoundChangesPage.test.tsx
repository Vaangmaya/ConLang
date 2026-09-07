// Guards the Sound Changes rules table through the Table-primitive refactor: the
// native <tr draggable> wiring and the parse-error placeholder must survive.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useWorkbenchStore } from '../state/store';
import { SoundChangesPage } from './SoundChangesPage';

afterEach(cleanup);

beforeEach(() => {
  const project = createDefaultProject();
  project.rules = [
    { id: 'r-a', raw: 'a > b', enabled: true },
    { id: 'r-b', raw: 'b > c', enabled: true },
    { id: 'r-c', raw: 'c > d', enabled: true },
  ];
  useWorkbenchStore.setState({ project, projectVersion: 0 });
});

describe('SoundChangesPage rules table', () => {
  it('keeps the drag handle and rule placeholder after the Table refactor', () => {
    render(<SoundChangesPage />);
    expect(screen.getAllByPlaceholderText('e.g. p > f')).toHaveLength(3);
    expect(screen.getAllByTitle('Drag to reorder')).toHaveLength(3);
  });

  it('reorders rules on a native row drag-and-drop', () => {
    const { container } = render(<SoundChangesPage />);
    const rows = container.querySelectorAll('tbody tr.rules-row');
    expect(rows).toHaveLength(3);

    fireEvent.dragStart(rows[0]!);
    fireEvent.dragOver(rows[2]!);
    fireEvent.drop(rows[2]!);

    expect(useWorkbenchStore.getState().project.rules.map((r) => r.id)).toEqual([
      'r-b',
      'r-c',
      'r-a',
    ]);
  });
});
