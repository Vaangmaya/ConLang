import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

afterEach(cleanup);

describe('Button', () => {
  it('uses its children as the accessible name and defaults to type=button', () => {
    render(<Button>Add rule</Button>);
    const btn = screen.getByRole('button', { name: 'Add rule' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toHaveClass('btn');
  });

  it('applies the variant modifier class', () => {
    render(<Button variant="primary">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('btn', 'btn--primary');
  });

  it('fires onClick when enabled and not when disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Run</Button>);
    screen.getByRole('button', { name: 'Run' }).click();
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button disabled onClick={onClick}>
        Run
      </Button>,
    );
    screen.getByRole('button', { name: 'Run' }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards arbitrary props and merges className', () => {
    render(
      <Button className="extra" title="tip" aria-label="labelled">
        x
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'labelled' });
    expect(btn).toHaveClass('btn', 'extra');
    expect(btn).toHaveAttribute('title', 'tip');
  });
});
