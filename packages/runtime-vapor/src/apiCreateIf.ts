import { type BlockFn, DynamicFragment } from './block'
import { renderEffect } from './renderEffect'

export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
  // hydrationNode?: Node,
): DynamicFragment {
  const frag = new DynamicFragment('if')
  if (once) {
    frag.update(condition() ? b1 : b2)
  } else {
    renderEffect(() => frag.update(condition() ? b1 : b2))
  }
  return frag
}
