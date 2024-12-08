import {
  popWarningContext,
  pushWarningContext,
  setCurrentInstance,
} from '@vue/runtime-core'
import { normalizeBlock } from './block'
import { type VaporComponentInstance, devRender } from './component'
import { insert, remove } from './dom/node'

export function hmrRerender(instance: VaporComponentInstance): void {
  const normalized = normalizeBlock(instance.block)
  const parent = normalized[0].parentNode!
  const anchor = normalized[normalized.length - 1].nextSibling
  remove(instance.block, parent)
  const reset = setCurrentInstance(instance)
  pushWarningContext(instance)
  devRender(instance)
  reset()
  popWarningContext()
  insert(instance.block, parent, anchor)
}
