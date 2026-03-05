import {
  isKeepAlive,
  popWarningContext,
  pushWarningContext,
  setCurrentInstance,
} from '@vue/runtime-dom'
import { type Block, insert, normalizeBlock, remove } from './block'
import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
  devRender,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { isArray } from '@vue/shared'
import { isFragment } from './fragment'

export function hmrRerender(instance: VaporComponentInstance): void {
  const normalized = normalizeBlock(instance.block)
  const parent = normalized[0].parentNode!
  const anchor = normalized[normalized.length - 1].nextSibling
  // reset scope to avoid stale effects
  instance.scope.reset()
  remove(instance.block, parent)
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
  // If parent is KeepAlive, rerender it so new component goes through
  // KeepAlive's slot rendering flow to receive activated hooks properly
  if (instance.parent && isKeepAlive(instance.parent)) {
    instance.parent.hmrRerender!()
    return
  }
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
  updateParentTeleportOnHmrReload(instance, newInstance)
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
    parentInstance.block = replaceBlockInstance(
      parentInstance.block,
      instance,
      newInstance,
    )
  }
}

/**
 * dev only
 * during root component HMR reload, since the old component will be unmounted
 * and a new one will be mounted, we need to update the teleport's nodes
 * to ensure that the correct parent and anchor are found during parentInstance
 * HMR rerender/reload, as `normalizeBlock` relies on the current instance.block
 */
export function updateParentTeleportOnHmrReload(
  instance: VaporComponentInstance,
  newInstance: VaporComponentInstance,
): void {
  const teleport = instance.parentTeleport
  if (teleport) {
    newInstance.parentTeleport = teleport
    teleport.nodes = replaceBlockInstance(teleport.nodes, instance, newInstance)
  }
}

function replaceBlockInstance(
  block: Block,
  instance: VaporComponentInstance,
  newInstance: VaporComponentInstance,
): Block {
  if (block === instance) return newInstance

  if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      block[i] = replaceBlockInstance(block[i], instance, newInstance)
    }
    return block
  }

  if (isVaporComponent(block)) {
    block.block = replaceBlockInstance(block.block, instance, newInstance)
    return block
  }

  if (isFragment(block)) {
    block.nodes = replaceBlockInstance(block.nodes, instance, newInstance)
    return block
  }

  return block
}
