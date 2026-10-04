import type { Block } from '../block'
import type { VaporFragment } from '../fragment'
import { isInteropEnabled } from '../vdomInteropState'

// Declares a block's own key; never propagated. Transition, TransitionGroup
// and KeepAlive read it at resolution time, like `vnode.key`.
export function setBlockKey(
  block: Exclude<Block, Block[]> & { $key?: any },
  key: any,
): void {
  const frag = block as VaporFragment
  frag.$key = key
  if (isInteropEnabled && frag.setKey) frag.setKey(key)
}
