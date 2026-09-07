import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useWorkbenchStore } from '../state/store';
import { LandingPage } from './LandingPage';

afterEach(cleanup);
beforeEach(() => {
  useWorkbenchStore.setState({ view: 'home' });
});

describe('LandingPage', () => {
  it('renders the hero wordmark', () => {
    render(<LandingPage />);
    expect(
      screen.getByRole('heading', { name: 'Conlang Workbench' }),
    ).toBeInTheDocument();
  });

  it('"Enter the workbench" navigates to the Inventory view', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);
    await user.click(screen.getByRole('button', { name: /enter the workbench/i }));
    expect(useWorkbenchStore.getState().view).toBe('inventory');
  });

  it('"Read the primer" navigates to Learn', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);
    await user.click(screen.getAllByRole('button', { name: /read the primer/i })[0]!);
    expect(useWorkbenchStore.getState().view).toBe('learn');
  });

  it('each how-it-works step opens its tool page', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);
    await user.click(
      screen.getByRole('button', { name: /set the rules of the syllable/i }),
    );
    expect(useWorkbenchStore.getState().view).toBe('phonotactics');
  });
});
