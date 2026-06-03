import {
  popWarningContext,
  pushWarningContext,
  setCurrentInstance,
} from '@vue/runtime-dom'
import { findBlockBoundary, insert, remove } from './block'
import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
  devRender,
  mountComponent,
  unmountComponent,
} from './component'

export function hmrRerender(instance: VaporComponentInstance): void {
  const { parentNode, nextNode: anchor } = findBlockBoundary(instance.block)
  const parent = parentNode as ParentNode
  // reset scope to avoid stale effects
  instance.scope.reset()
  remove(instance.block, parent)
  const prev = setCurrentInstance(instance)
  pushWarningContext(instance)
  try {
    devRender(instance)
  } finally {
    popWarningContext()
    setCurrentInstance(...prev)
  }
  insert(instance.block, parent, anchor)
}

export function hmrReload(
  instance: VaporComponentInstance,
  newComp: VaporComponent,
): void {
  const parentInstance = instance.parent

  // Align child reloads with VDOM HMR: rerender the parent instead of
  // surgically swapping the child instance. A local swap can leave parent
  // block ownership, component refs, or exposed instances pointing at the old
  // instance.
  if (parentInstance) {
    parentInstance.hmrRerender!()
    return
  }

  const { parentNode, nextNode: anchor } = findBlockBoundary(instance.block)
  const parent = parentNode as ParentNode
  unmountComponent(instance, parent)
  const prev = setCurrentInstance(parentInstance)
  let newInstance: VaporComponentInstance
  try {
    newInstance = createComponent(
      newComp,
      instance.rawProps,
      instance.rawSlots,
      instance.isSingleRoot,
      undefined,
      instance.appContext,
    )
  } finally {
    setCurrentInstance(...prev)
  }
  mountComponent(newInstance, parent, anchor)

  const app = instance.appContext.app
  if (app && app._instance === instance) {
    app._instance = newInstance
  }
}
