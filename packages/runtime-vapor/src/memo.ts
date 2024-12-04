export const memoStack: Array<() => any[]> = []

export function withMemo<T>(memo: () => any[], callback: () => T): T {
  memoStack.push(memo)
  const res = callback()
  memoStack.pop()
  return res
}
