import { type BlockFn, DynamicFragment } from './block'
import { renderEffect } from './renderEffect'

export function createIf(
  ifBlockGetter: () => BlockFn | undefined,
  once?: boolean,
  // hydrationNode?: Node,
): DynamicFragment {
  const frag = __DEV__ ? new DynamicFragment('if') : new DynamicFragment()
  if (once) {
    frag.update(ifBlockGetter())
  } else {
    renderEffect(() => frag.update(ifBlockGetter()))
  }
  return frag
}
