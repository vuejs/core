import {
  currentInstance,
  popWarningContext,
  pushWarningContext,
  simpleSetCurrentInstance,
} from '@vue/runtime-core'
import { normalizeBlock } from './block'
import { type VaporComponentInstance, devRender } from './component'
import { insert, remove } from './dom/node'

export function hmrRerender(instance: VaporComponentInstance): void {
  const normalized = normalizeBlock(instance.block)
  const parent = normalized[0].parentNode!
  const anchor = normalized[normalized.length - 1].nextSibling
  remove(instance.block, parent)
  const prev = currentInstance
  simpleSetCurrentInstance(instance)
  pushWarningContext(instance)
  devRender(instance)
  popWarningContext()
  simpleSetCurrentInstance(prev, instance)
  insert(instance.block, parent, anchor)
}

export function hmrReload(instance: VaporComponentInstance): void {
  // in parent block, find the corresponding block of this instance
  // create new instance, replace
}
