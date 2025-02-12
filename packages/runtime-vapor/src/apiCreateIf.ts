import { type Block, type BlockFn, DynamicFragment } from './block'
import { renderEffect } from './renderEffect'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
  // hydrationNode?: Node,
): Block {
  if (once) {
    return condition() ? b1() : b2 ? b2() : []
  } else {
    const frag = __DEV__ ? new DynamicFragment('if') : new DynamicFragment()
    renderEffect(() => frag.update(condition() ? b1 : b2))
    return frag
  }
}
