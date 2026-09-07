import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Table } from './Table';

afterEach(cleanup);

describe('Table', () => {
  it('renders an aria-labelled table wrapped in a scroll container by default', () => {
    const { container } = render(
      <Table label="Frequency report">
        <tbody>
          <tr>
            <td>a</td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(container.querySelector('.ptable-scroll .ptable')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Frequency report' })).toBeInTheDocument();
  });

  it('drops the scroll wrapper when scroll={false} and merges className', () => {
    const { container } = render(
      <Table scroll={false} className="freq-table">
        <tbody>
          <tr>
            <td>a</td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(container.querySelector('.ptable-scroll')).toBeNull();
    expect(container.querySelector('table.ptable')).toHaveClass('freq-table');
  });

  it('forwards rest props to the table element', () => {
    render(
      <Table label="t" data-testid="tbl">
        <tbody>
          <tr>
            <td>a</td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByTestId('tbl').tagName).toBe('TABLE');
  });
});
