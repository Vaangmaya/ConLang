import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Field } from './Field';

afterEach(cleanup);

describe('Field', () => {
  it('associates the label with its control so getByLabelText resolves it', () => {
    render(
      <Field label="Words to generate">
        <input type="number" />
      </Field>,
    );
    expect(screen.getByLabelText('Words to generate')).toHaveAttribute('type', 'number');
  });

  it('matches a partial label regex like the acceptance test uses', () => {
    render(
      <Field label="Name" inline>
        <input type="text" />
      </Field>,
    );
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
  });

  it('respects an explicit htmlFor', () => {
    render(
      <Field label="Seed" htmlFor="seed-x">
        <input type="number" />
      </Field>,
    );
    expect(screen.getByLabelText('Seed')).toHaveAttribute('id', 'seed-x');
  });

  it('keeps a child id the caller already set', () => {
    render(
      <Field label="Scope">
        <select id="my-scope">
          <option>a</option>
        </select>
      </Field>,
    );
    expect(screen.getByLabelText('Scope')).toHaveAttribute('id', 'my-scope');
  });

  it('renders an error via the shared .error-text class and marks inline', () => {
    const { container } = render(
      <Field label="Weight" inline error="too small">
        <input type="number" />
      </Field>,
    );
    expect(screen.getByText('too small')).toHaveClass('error-text');
    expect(container.querySelector('.field')).toHaveClass('field--inline');
  });
});
