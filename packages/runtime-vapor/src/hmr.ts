import {
  popWarningContext,
  pushWarningContext,
  setCurrentInstance,
} from '@vue/runtime-dom'
import { insert, normalizeBlock, remove } from './block'
import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
  devRender,
  mountComponent,
  unmountComponent,
} from './component'
import { handleTeleportRootComponentHmrReload } from './components/Teleport'

export function hmrRerender(instance: VaporComponentInstance): void {
  const normalized = normalizeBlock(instance.block)
  const parent = normalized[0].parentNode!
  const anchor = normalized[normalized.length - 1].nextSibling
  remove(instance.block, parent)
  // cleanup scope
  const sub = instance.scope!
  const l = sub.cleanupsLength
  if (l) {
    for (let i = 0; i < l; i++) {
      sub.cleanups[i]()
    }
    sub.cleanupsLength = 0
  }
  const prev = setCurrentInstance(instance)
  pushWarningContext(instance)
  devRender(instance)
  popWarningContext()
  setCurrentInstance(...prev)
  insert(instance.block, parent, anchor)
}

export function hmrReload(
  instance: VaporComponentInstance,
  newComp: VaporComponent,
): void {
  const normalized = normalizeBlock(instance.block)
  const parent = normalized[0].parentNode!
  const anchor = normalized[normalized.length - 1].nextSibling
  unmountComponent(instance, parent)
  const prev = setCurrentInstance(instance.parent)
  const newInstance = createComponent(
    newComp,
    instance.rawProps,
    instance.rawSlots,
    instance.isSingleRoot,
  )
  setCurrentInstance(...prev)
  mountComponent(newInstance, parent, anchor)
  handleTeleportRootComponentHmrReload(instance, newInstance)
}
