// One-line framing under a tool page's <h2>, with a link into the Learn primer.
// Not a design primitive — a shared bit of page chrome (DESIGN.md §5.8).

import type { ReactNode } from 'react';
import { useWorkbenchStore } from '../state/store';

export function PageIntro({ children }: { children: ReactNode }): JSX.Element {
  const setView = useWorkbenchStore((s) => s.setView);
  return (
    <p className="page-intro">
      {children}{' '}
      <button type="button" onClick={() => setView('learn')}>
        Learn more →
      </button>
    </p>
  );
}
