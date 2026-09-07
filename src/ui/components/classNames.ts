// Tiny classlist joiner for the UI primitives — drops falsy parts so callers can
// write `cx('btn', active && 'is-active', className)` without ternary noise.

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
