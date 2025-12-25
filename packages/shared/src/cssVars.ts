/**
 * Normalize CSS var value created by `v-bind` in `<style>` block
 * See https://github.com/vuejs/core/pull/12461#issuecomment-2495804664
 */
export function normalizeCssVarValue(value: unknown): string {
  // null / undefined → reset CSS variable
  if (value == null) {
    return 'initial'
  }

  // strings are mostly passed through
  if (typeof value === 'string') {
    // empty string is not a valid CSS var value
    return value === '' ? ' ' : value
  }

  // numbers must be finite
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return String(value)
    }
  }

  // everything else is invalid but tolerated
  if (__DEV__) {
    console.warn(
      '[Vue warn] Invalid value used for CSS binding. Expected a string or a finite number but received:',
      value,
    )
  }

  return String(value)
}
