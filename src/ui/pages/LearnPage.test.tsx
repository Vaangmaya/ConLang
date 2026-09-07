import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LearnPage } from './LearnPage';

afterEach(cleanup);

describe('LearnPage', () => {
  it('renders all four primer sections', () => {
    render(<LearnPage />);
    for (const title of [
      'Sounds & the IPA',
      'Designing an inventory',
      'Phonotactics',
      'Sound change',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('every link opens safely in a new tab', () => {
    render(<LearnPage />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(4);
    for (const a of links) {
      expect(a).toHaveAttribute('href', expect.stringMatching(/^https?:\/\//));
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });
});
