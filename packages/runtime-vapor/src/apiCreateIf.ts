import { type Block, type BlockFn, DynamicFragment } from './block'
import { isHydrating, locateHydrationNode } from './dom/hydration'
import { renderEffect } from './renderEffect'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
): Block {
  if (isHydrating) {
    locateHydrationNode()
  }

  let frag: Block
  if (once) {
    frag = condition() ? b1() : b2 ? b2() : []
  } else {
    frag = __DEV__ ? new DynamicFragment('if') : new DynamicFragment()
    renderEffect(() => (frag as DynamicFragment).update(condition() ? b1 : b2))
  }

  return frag
}
