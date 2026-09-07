// Panel primitive: the bordered card that was a repeated inline style object across
// the Phonotactics editor rail. Optional header row carries a title and an actions
// slot (typically a ghost Remove button).

import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './classNames';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  title?: ReactNode;
  actions?: ReactNode;
  as?: 'div' | 'section' | 'fieldset';
}

export function Panel({
  title,
  actions,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: PanelProps): JSX.Element {
  return (
    <Tag className={cx('panel', className)} {...rest}>
      {(title != null || actions != null) && (
        <div className="panel-head">
          {title != null && <span className="panel-title">{title}</span>}
          {actions != null && <span className="panel-actions">{actions}</span>}
        </div>
      )}
      {children}
    </Tag>
  );
}
