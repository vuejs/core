import { isArray } from '@vue/shared'
import { isKeepAlive } from '@vue/runtime-dom'
import type { Block } from '../block'
import { isVaporComponent } from '../component'
import { isKeepAliveEnabled } from '../keepAlive'

export function setBlockKey(
  block: (Block & { $key?: any }) | null | undefined,
  key: any,
): void {
  if (!block) return

  if (block instanceof Node) {
    block.$key = key
  } else if (isVaporComponent(block)) {
    block.$key = key
    // KeepAlive resolves cache keys from its child block. An outer wrapper key
    // (for example from v-if) must not override the child's own component type
    // or explicit key, otherwise cached branches will not be found again.
    if ((!isKeepAliveEnabled || !isKeepAlive(block)) && block.block) {
      setBlockKey(block.block, key)
    }
  } else if (isArray(block)) {
    if (block.length === 1) {
      setBlockKey(block[0], key)
    }
  } else {
    block.$key = key
    if (block.vnode) block.vnode.key = key
    setBlockKey(block.nodes, key)
  }
}
