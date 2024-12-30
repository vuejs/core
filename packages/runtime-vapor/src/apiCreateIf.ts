import { type BlockFn, DynamicFragment } from './block'
import { renderEffect } from './renderEffect'

export function createIf(
  ifBlockFn: () => BlockFn,
  once?: boolean,
  // hydrationNode?: Node,
): DynamicFragment {
  const frag = __DEV__ ? new DynamicFragment('if') : new DynamicFragment()
  if (once) {
    frag.update(ifBlockFn())
  } else {
    renderEffect(() => frag.update(ifBlockFn()))
  }
  return frag
}
