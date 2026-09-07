import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useWorkbenchStore } from '../state/store';
import { PageIntro } from './PageIntro';

afterEach(cleanup);
beforeEach(() => {
  useWorkbenchStore.setState({ view: 'inventory' });
});

describe('PageIntro', () => {
  it('renders its children and a Learn more link', () => {
    render(<PageIntro>Pick your phonemes.</PageIntro>);
    expect(screen.getByText(/Pick your phonemes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument();
  });

  it('navigates to the Learn view when clicked', async () => {
    const user = userEvent.setup();
    render(<PageIntro>x</PageIntro>);
    await user.click(screen.getByRole('button', { name: /learn more/i }));
    expect(useWorkbenchStore.getState().view).toBe('learn');
  });
});
