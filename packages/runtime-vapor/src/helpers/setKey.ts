import { isArray } from '@vue/shared'
import { warn } from '@vue/runtime-dom'
import type { Block } from '../block'
import { isVaporComponent } from '../component'

export function setBlockKey(
  block: (Block & { $key?: any }) | null | undefined,
  key: any,
): void {
  if (!block) return

  if (block instanceof Node) {
    block.$key = key
  } else if (isVaporComponent(block)) {
    block.$key = key
    if (block.block) setBlockKey(block.block, key)
  } else if (isArray(block)) {
    if (block.length === 1) {
      setBlockKey(block[0], key)
    } else if (__DEV__ && block.length > 1) {
      warn(`key cannot be applied to multiple root elements.`)
    }
  } else {
    block.$key = key
    if (block.vnode) block.vnode.key = key
    setBlockKey(block.nodes, key)
  }
}
