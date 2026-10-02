import {
  popWarningContext,
  pushWarningContext,
  restoreCurrentInstance,
  setCurrentInstance,
} from '@vue/runtime-dom'
import {
  type TransitionBlock,
  type VaporTransitionHooks,
  findBlockBoundary,
  insert,
  remove,
} from './block'
import {
  type VaporComponent,
  type VaporComponentInstance,
  applyComponentFallthrough,
  createComponent,
  getRootElement,
  mountComponent,
  runDevRender,
  unmountComponent,
} from './component'
import { applyComponentScopeIds } from './scopeId'
import { applyComponentCssVars } from './helpers/useCssVars'
import { isTransitionEnabled } from './transition'
import {
  currentRenderContext,
  deriveSlotScopeIds,
  withRenderContext,
} from './renderContext'

export function hmrRerender(instance: VaporComponentInstance): void {
  // an ancestor recreated for an earlier instance of the same HMR record
  // already replaced this one
  if (instance.isUnmounted) return
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
  // The root is swapped in place, not transitioned. Take the hooks an
  // enclosing Transition applied through this component off the old root
  // chain so it is removed without a leave; the new root gets them back once
  // it is inserted, past its enter.
  let transition: VaporTransitionHooks | undefined
  if (isTransitionEnabled) {
    const take = (block: TransitionBlock) => {
      if (block.$transition) {
        transition = block.$transition
        block.$transition = undefined
      }
    }
    const root = getRootElement(instance.block, {
      onDynamicFragment: take,
      onInteropFragment: take,
    })
    if (root) take(root)
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
  const hooks = instance.hmrRootHooks
  if (hooks) {
    for (const hook of hooks) hook(instance.block)
  }
  insert(instance.block, parent, anchor)
  if (transition) {
    if (!transition.__vapor) {
      // vdom hooks belong to the vnode, not to the element they sit on
      const root = getRootElement(instance.block) as TransitionBlock | undefined
      if (root) root.$transition = transition
    } else if (!transition.state.isUnmounting) {
      // the owning Transition is still there: it resolves its content again
      transition.state.refresh!(transition)
    }
  }
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
      true,
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
