// Zustand store: holds a single Project plus UI state. Every mutation delegates
// to a pure core function (DESIGN.md §5) — components never re-implement core logic.

import { create } from 'zustand';
import type { Project } from '../../core/project';

export interface WorkbenchState {
  project: Project | null;
}

export const useWorkbenchStore = create<WorkbenchState>(() => ({
  project: null,
}));
