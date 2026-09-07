// Button primitive. The element reset in styles.css already token-styles a bare
// <button>; this only adds optional emphasis variants and a safe default type, and
// forwards every other prop so callers keep full control of the DOM node.

import type { ButtonHTMLAttributes } from 'react';
import { cx } from './classNames';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = 'default',
  type = 'button',
  className,
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={cx(
        'btn',
        variant === 'primary' && 'btn--primary',
        variant === 'ghost' && 'btn--ghost',
        variant === 'danger' && 'btn--danger',
        className,
      )}
      {...rest}
    />
  );
}
