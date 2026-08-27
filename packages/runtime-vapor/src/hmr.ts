import {
  popWarningContext,
  pushWarningContext,
  restoreCurrentInstance,
  setCurrentInstance,
} from '@vue/runtime-dom'
import { findBlockBoundary, insert, remove } from './block'
import {
  type VaporComponent,
  type VaporComponentInstance,
  applyComponentFallthrough,
  createComponent,
  mountComponent,
  runDevRender,
  unmountComponent,
} from './component'
import { applyComponentScopeIds, setCurrentSlotScopeIds } from './scopeId'

export function hmrRerender(instance: VaporComponentInstance): void {
  // A component without a separate render function (built-ins like
  // KeepAlive, reached via reload delegation) cannot re-run its template
  // alone - degrade to reload semantics through the nearest vapor parent.
  // Terminal cases (custom element root, vdom parent) fall through to an
  // in-place setup re-run.
  if (!instance.type.render) {
    const parent = instance.parent
    if (parent && parent.vapor) return parent.hmrRerender!()
    if (!parent && !instance.ce) return instance.hmrReload!(instance.type)
  }
  const { parentNode, nextNode: anchor } = findBlockBoundary(instance.block)
  const parent = parentNode as ParentNode
  if (instance.renderScope) {
    instance.renderScope.stop()
  }
  remove(instance.block, parent)
  const prev = setCurrentInstance(instance)
  pushWarningContext(instance)
  // The rerender recreates the component's own template window, where slot
  // scope ids never apply; root-only ids are re-applied below.
  const prevSlotScopeIds = setCurrentSlotScopeIds(null)
  try {
    runDevRender(instance)
    applyComponentFallthrough(instance)
  } finally {
    setCurrentSlotScopeIds(prevSlotScopeIds)
    popWarningContext()
    restoreCurrentInstance(prev)
  }
  applyComponentScopeIds(instance)
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
    restoreCurrentInstance(prev)
  }
  mountComponent(newInstance, parent, anchor)

  const app = instance.appContext.app
  if (app && app._instance === instance) {
    app._instance = newInstance
  }
}
