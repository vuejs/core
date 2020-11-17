const hasWarned: Record<string, boolean> = {}

export function warnOnce(msg: string) {
  if (!hasWarned[msg]) {
    hasWarned[msg] = true
    warn(msg)
  }
}

export function warn(msg: string) {
  console.warn(`\x1b[33m[@vue/compiler-sfc] ${msg}\x1b[0m\n`)
}
