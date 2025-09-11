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
import { isArray } from '@vue/shared'

export function hmrRerender(instance: VaporComponentInstance): void {
  const normalized = normalizeBlock(instance.block)
  const parent = normalized[0].parentNode!
  const anchor = normalized[normalized.length - 1].nextSibling
  remove(instance.block, parent)
  instance.scope.cleanup()
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
  const parentInstance = instance.parent as VaporComponentInstance | null
  const prev = setCurrentInstance(parentInstance)
  const newInstance = createComponent(
    newComp,
    instance.rawProps,
    instance.rawSlots,
    instance.isSingleRoot,
  )
  setCurrentInstance(...prev)
  mountComponent(newInstance, parent, anchor)

  updateParentBlockOnHmrReload(parentInstance, instance, newInstance)
}

/**
 * dev only
 * update parentInstance.block to ensure that the correct parent and
 * anchor are found during parentInstance HMR rerender/reload, as
 * `normalizeBlock` relies on the current instance.block
 */
function updateParentBlockOnHmrReload(
  parentInstance: VaporComponentInstance | null,
  instance: VaporComponentInstance,
  newInstance: VaporComponentInstance,
): void {
  if (parentInstance) {
    if (parentInstance.block === instance) {
      parentInstance.block = newInstance
    } else if (isArray(parentInstance.block)) {
      for (let i = 0; i < parentInstance.block.length; i++) {
        if (parentInstance.block[i] === instance) {
          parentInstance.block[i] = newInstance
          break
        }
      }
    }
  }
}
