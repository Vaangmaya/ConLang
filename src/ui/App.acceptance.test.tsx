// Phase 5 acceptance loop (DESIGN.md §7): build a language from scratch, generate
// words, apply sound changes, view a derivation, export, and round-trip save/load —
// exercised end-to-end through real component interactions rather than mocks. No
// browser was available in this environment, so this jsdom-driven integration test
// stands in for (and now permanently automates) the manual walkthrough.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createDefaultProject, useWorkbenchStore } from './state/store';

// jsdom's Blob doesn't implement .text(); FileReader is the portable readback.
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function resetStore(): void {
  useWorkbenchStore.setState({
    project: createDefaultProject(),
    projectVersion: 0,
    view: 'home',
    importErrors: null,
    lexiconDiagnostics: null,
    lexiconError: null,
    preview: null,
  });
}

describe('Phase 5 acceptance loop', () => {
  let capturedBlob: Blob | null;

  beforeEach(() => {
    resetStore();
    capturedBlob = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('builds Hawaiian, generates words, derives, exports, and reloads', async () => {
    const user = userEvent.setup();
    render(<App />);

    // --- Front door: the app opens on the landing page (DESIGN.md §5.7) ---
    await user.click(screen.getByRole('button', { name: /enter the workbench/i }));

    // --- Inventory: a small Hawaiian-like phoneme set ---
    for (const ipa of ['p', 'k', 'ʔ', 'h', 'm', 'n', 'w', 'l', 'a', 'e', 'i', 'o', 'u']) {
      await user.click(screen.getByRole('button', { name: ipa }));
    }
    expect(useWorkbenchStore.getState().project.inventory.phonemes).toHaveLength(13);

    // --- Phonotactics: V and CV templates ---
    await user.click(screen.getByRole('button', { name: 'Phonotactics' }));
    await user.click(screen.getByRole('button', { name: 'Add template' }));
    await user.click(screen.getByRole('button', { name: 'Add template' }));
    const templateInputs = screen.getAllByPlaceholderText('e.g. CV(C)');
    fireEvent.change(templateInputs[0]!, { target: { value: 'V' } });
    fireEvent.change(templateInputs[1]!, { target: { value: 'CV' } });

    await waitFor(() =>
      expect(useWorkbenchStore.getState().project.grammar.templates).toHaveLength(2),
    );
    expect(screen.queryByText(/position \d+/)).not.toBeInTheDocument();

    // --- Lexicon: generate 500 words ---
    await user.click(screen.getByRole('button', { name: 'Lexicon' }));
    fireEvent.change(screen.getByLabelText(/Words to generate/), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText(/Seed/), { target: { value: '42' } });
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() =>
      expect(useWorkbenchStore.getState().project.lexicon).toHaveLength(500),
    );
    expect(screen.getByText('500 word(s)')).toBeInTheDocument();
    expect(useWorkbenchStore.getState().lexiconError).toBeNull();

    // Export CSV: verify the download button drives the real export path.
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(capturedBlob).not.toBeNull();
    const csvText = await readBlobText(capturedBlob!);
    const csvLines = csvText.trim().split('\n');
    expect(csvLines[0]).toBe('ipa,romanized,syllables');
    expect(csvLines).toHaveLength(501);

    // --- Sound Changes: three ordered rules ---
    await user.click(screen.getByRole('button', { name: 'Sound Changes' }));
    await user.click(screen.getByRole('button', { name: 'Add rule' }));
    await user.click(screen.getByRole('button', { name: 'Add rule' }));
    await user.click(screen.getByRole('button', { name: 'Add rule' }));
    const ruleInputs = screen.getAllByPlaceholderText('e.g. p > f');
    fireEvent.change(ruleInputs[0]!, { target: { value: 'p > f' } });
    fireEvent.change(ruleInputs[1]!, { target: { value: 'k > x' } });
    fireEvent.change(ruleInputs[2]!, { target: { value: 'ʔ > ∅' } });

    expect(screen.queryByText(/position \d+/)).not.toBeInTheDocument();
    expect(
      useWorkbenchStore.getState().project.rules.every((r) => r.ast !== undefined),
    ).toBe(true);

    // View a derivation for the first word.
    const showButtons = screen.getAllByRole('button', { name: 'Show derivation' });
    await user.click(showButtons[0]!);
    expect(screen.getByRole('list', { name: 'Derivation steps' })).toBeInTheDocument();

    // --- Project: save, reset, and reload ---
    await user.click(screen.getByRole('button', { name: 'Project' }));
    const nameInput = screen.getByLabelText(/Name/);
    fireEvent.change(nameInput, { target: { value: 'Test Reload Lang' } });

    await user.click(screen.getByRole('button', { name: 'Save (download JSON)' }));
    expect(capturedBlob).not.toBeNull();
    const savedJson = await readBlobText(capturedBlob!);
    expect(JSON.parse(savedJson).name).toBe('Test Reload Lang');

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(useWorkbenchStore.getState().project.name).toBe('Untitled Language');
    expect(useWorkbenchStore.getState().project.lexicon).toHaveLength(0);

    const file = new File([savedJson], 'project.json', { type: 'application/json' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await waitFor(() =>
      expect(useWorkbenchStore.getState().project.name).toBe('Test Reload Lang'),
    );
    expect(useWorkbenchStore.getState().project.lexicon).toHaveLength(500);
    expect(useWorkbenchStore.getState().importErrors).toBeNull();
    expect(screen.queryByText(/Couldn't load project/)).not.toBeInTheDocument();
  }, 30000);
});
