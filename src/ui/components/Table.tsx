// Table primitive, deliberately thin: it renders <table> (optionally inside an
// overflow-x wrapper, mirroring .chart-wrap) and nothing else. Callers keep native
// <thead>/<tbody>/<tr>/<th>/<td> so a live draggable <tr> or a <Fragment> of
// expandable rows keeps working, and the element reset already styles th/td.

import type { TableHTMLAttributes } from 'react';
import { cx } from './classNames';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  label?: string;
  scroll?: boolean;
}

export function Table({
  label,
  scroll = true,
  className,
  children,
  ...rest
}: TableProps): JSX.Element {
  const table = (
    <table className={cx('ptable', className)} aria-label={label} {...rest}>
      {children}
    </table>
  );
  return scroll ? <div className="ptable-scroll">{table}</div> : table;
}
