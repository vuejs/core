import type { BlockFn, Fragment } from './block'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
  // hydrationNode?: Node,
): Fragment {
  return [] as any
}
