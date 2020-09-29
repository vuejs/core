export function ssrResolveCssVars(
  source: Record<string, string>,
  scopeId?: string
) {
  const style: Record<string, string> = {}
  const prefix = scopeId ? `${scopeId.replace(/^data-v-/, '')}-` : ``
  for (const key in source) {
    style[`--${prefix}${key}`] = source[key]
  }
  return { style }
}
