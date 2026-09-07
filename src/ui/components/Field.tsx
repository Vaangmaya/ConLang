// Field primitive: a real <label htmlFor> bound to a single form control. It injects
// the resolved id onto its child so `getByLabelText(...)` keeps working after a page
// moves off the implicit `<label>text <input/></label>` pattern. Checkboxes keep the
// native wrapping-label form instead — see `.checkbox` in styles.css.

import { cloneElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { cx } from './classNames';

export interface FieldProps {
  label: ReactNode;
  /** Exactly one control element (native <input> / <select>). */
  children: ReactElement;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  inline?: boolean;
  className?: string;
}

export function Field({
  label,
  children,
  htmlFor,
  hint,
  error,
  inline = false,
  className,
}: FieldProps): JSX.Element {
  const autoId = useId();
  const childId = (children.props as { id?: string }).id;
  const id = htmlFor ?? childId ?? autoId;

  return (
    <div className={cx('field', inline && 'field--inline', className)}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, { id })}
      {hint != null && <span className="field-hint">{hint}</span>}
      {error != null && <span className="error-text">{error}</span>}
    </div>
  );
}
