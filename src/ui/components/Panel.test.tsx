import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Panel } from './Panel';

afterEach(cleanup);

describe('Panel', () => {
  it('renders a title and actions in a header row', () => {
    const { container } = render(
      <Panel title="Sonority" actions={<button type="button">Remove</button>}>
        body
      </Panel>,
    );
    expect(container.querySelector('.panel-head')).toBeInTheDocument();
    expect(screen.getByText('Sonority')).toHaveClass('panel-title');
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('omits the header row when neither title nor actions is given', () => {
    const { container } = render(<Panel>just body</Panel>);
    expect(container.querySelector('.panel-head')).toBeNull();
    expect(container.querySelector('.panel')).toHaveTextContent('just body');
  });

  it('honours the as prop and forwards rest props', () => {
    const { container } = render(
      <Panel as="section" className="constraint-panel" aria-label="c">
        x
      </Panel>,
    );
    const el = container.querySelector('section.panel');
    expect(el).toHaveClass('constraint-panel');
    expect(el).toHaveAttribute('aria-label', 'c');
  });
});
