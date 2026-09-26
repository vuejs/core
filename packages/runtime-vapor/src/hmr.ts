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
import { applyComponentScopeIds } from './scopeId'
import { applyComponentCssVars } from './helpers/useCssVars'
import {
  currentRenderContext,
  deriveSlotScopeIds,
  withRenderContext,
} from './renderContext'

export function hmrRerender(instance: VaporComponentInstance): void {
  // A component without a separate render function (built-ins like
  // KeepAlive, reached via reload delegation) cannot re-run its template
  // alone - degrade to reload semantics through the nearest vapor ancestor,
  // past the vdom component rendering its slot. Terminal cases (custom
  // element root, no vapor ancestor) fall through to an in-place setup re-run.
  if (!instance.type.render) {
    let parent = instance.parent
    while (parent && !parent.vapor) parent = parent.parent
    if (parent) return parent.hmrRerender!()
    if (!instance.parent && !instance.ce) {
      return instance.hmrReload!(instance.type)
    }
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
  try {
    withRenderContext(deriveSlotScopeIds(currentRenderContext, null), () => {
      runDevRender(instance)
      applyComponentFallthrough(instance)
    })
  } finally {
    popWarningContext()
    restoreCurrentInstance(prev)
  }
  applyComponentScopeIds(instance)
  applyComponentCssVars(instance)
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
