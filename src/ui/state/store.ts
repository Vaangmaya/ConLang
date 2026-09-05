// Zustand store: holds a single Project plus UI state. Every mutation delegates
// to a pure core function (DESIGN.md §5) — components never re-implement core logic.

import { create } from 'zustand';
import type { Constraint, PhonemeClass } from '../../core/classes';
import { generate, type GenDiagnostics, type GeneratedWord } from '../../core/generator';
import type { Inventory } from '../../core/phoneme';
import {
  parseProject,
  type Project,
  type ProjectValidationError,
} from '../../core/project';
import type { SoundChangeRule } from '../../core/soundchange/parser';

export function createDefaultProject(): Project {
  return {
    formatVersion: 1,
    name: 'Untitled Language',
    inventory: { phonemes: [] },
    grammar: {
      classes: [],
      templates: [],
      syllableCount: { min: 1, max: 1, weights: [1] },
      constraints: [],
    },
    lexicon: [],
    rules: [],
  };
}

export interface PreviewState {
  words: GeneratedWord[];
  diagnostics: GenDiagnostics;
  error?: string;
}

export interface WorkbenchState {
  project: Project;
  /** Bumped only on whole-project swaps (load/reset/fork), never on field edits —
   * pages key local editing state off this to reset drafts without losing
   * in-progress edits on every keystroke. */
  projectVersion: number;
  importErrors: ProjectValidationError[] | null;
  lexiconDiagnostics: GenDiagnostics | null;
  lexiconError: string | null;
  preview: PreviewState | null;

  setProjectName: (name: string) => void;
  setInventory: (inventory: Inventory) => void;
  setClasses: (classes: PhonemeClass[]) => void;
  setTemplates: (templates: Project['grammar']['templates']) => void;
  setConstraints: (constraints: Constraint[]) => void;
  setSyllableCount: (syllableCount: Project['grammar']['syllableCount']) => void;
  setRules: (rules: SoundChangeRule[]) => void;

  generateLexicon: (n: number, seed: number) => void;
  rerollWord: (index: number, seed: number) => void;
  deleteWord: (index: number) => void;
  setLexicon: (lexicon: GeneratedWord[]) => void;

  updatePreview: (seed: number) => void;

  forkDaughterLanguage: (name: string, lexicon: GeneratedWord[]) => void;
  loadProject: (json: unknown) => void;
  setProject: (project: Project) => void;
  resetProject: () => void;
  clearImportErrors: () => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  project: createDefaultProject(),
  projectVersion: 0,
  importErrors: null,
  lexiconDiagnostics: null,
  lexiconError: null,
  preview: null,

  setProjectName: (name) => set((s) => ({ project: { ...s.project, name } })),

  setInventory: (inventory) => set((s) => ({ project: { ...s.project, inventory } })),

  setClasses: (classes) =>
    set((s) => ({
      project: { ...s.project, grammar: { ...s.project.grammar, classes } },
    })),

  setTemplates: (templates) =>
    set((s) => ({
      project: { ...s.project, grammar: { ...s.project.grammar, templates } },
    })),

  setConstraints: (constraints) =>
    set((s) => ({
      project: { ...s.project, grammar: { ...s.project.grammar, constraints } },
    })),

  setSyllableCount: (syllableCount) =>
    set((s) => ({
      project: { ...s.project, grammar: { ...s.project.grammar, syllableCount } },
    })),

  setRules: (rules) => set((s) => ({ project: { ...s.project, rules } })),

  generateLexicon: (n, seed) => {
    const { project } = get();
    try {
      const result = generate(project.grammar, project.inventory, n, seed);
      set((s) => ({
        project: { ...s.project, lexicon: result.words },
        lexiconDiagnostics: result.diagnostics,
        lexiconError: null,
      }));
    } catch (e) {
      set({ lexiconError: e instanceof Error ? e.message : String(e) });
    }
  },

  rerollWord: (index, seed) => {
    const { project } = get();
    const result = generate(project.grammar, project.inventory, 1, seed);
    if (result.words.length === 0) return;
    set((s) => {
      const lexicon = [...s.project.lexicon];
      lexicon[index] = result.words[0]!;
      return { project: { ...s.project, lexicon } };
    });
  },

  deleteWord: (index) =>
    set((s) => ({
      project: {
        ...s.project,
        lexicon: s.project.lexicon.filter((_, i) => i !== index),
      },
    })),

  setLexicon: (lexicon) => set((s) => ({ project: { ...s.project, lexicon } })),

  updatePreview: (seed) => {
    const { project } = get();
    if (project.grammar.templates.length === 0) {
      set({ preview: null });
      return;
    }
    try {
      const result = generate(project.grammar, project.inventory, 10, seed);
      set({ preview: { words: result.words, diagnostics: result.diagnostics } });
    } catch (e) {
      set({
        preview: {
          words: [],
          diagnostics: { rejectedWords: 0, topRejectingConstraints: [] },
          error: e instanceof Error ? e.message : String(e),
        },
      });
    }
  },

  forkDaughterLanguage: (name, lexicon) =>
    set((s) => ({
      project: {
        ...s.project,
        name,
        lexicon,
        rules: [],
      },
      projectVersion: s.projectVersion + 1,
    })),

  loadProject: (json) => {
    const result = parseProject(json);
    if (result.ok) {
      set((s) => ({
        project: result.project,
        importErrors: null,
        projectVersion: s.projectVersion + 1,
      }));
    } else {
      set({ importErrors: result.errors });
    }
  },

  setProject: (project) =>
    set((s) => ({ project, importErrors: null, projectVersion: s.projectVersion + 1 })),

  resetProject: () =>
    set((s) => ({
      project: createDefaultProject(),
      importErrors: null,
      preview: null,
      projectVersion: s.projectVersion + 1,
    })),

  clearImportErrors: () => set({ importErrors: null }),
}));

/** A fresh seed for one-off UI actions (reroll, preview) — not used anywhere in core. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}
