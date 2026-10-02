import {
  popWarningContext,
  pushWarningContext,
  restoreCurrentInstance,
  setCurrentInstance,
} from '@vue/runtime-dom'
import {
  type Block,
  type TransitionBlock,
  type VaporTransitionHooks,
  type VaporTransitionState,
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
  isVaporComponent,
  mountComponent,
  runDevRender,
  unmountComponent,
} from './component'
import { applyComponentScopeIds } from './scopeId'
import { applyComponentCssVars } from './helpers/useCssVars'
import { isTransitionEnabled } from './transition'
import { isFragment } from './fragment'
import { isArray } from '@vue/shared'
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
  // The content is swapped in place, not transitioned. Take the hooks
  // enclosing Transitions applied through this component off the old content
  // so it is removed without a leave; the new content gets them back once it
  // is inserted, past its enter.
  const transitions: TakenTransitions | undefined = isTransitionEnabled
    ? new Map()
    : undefined
  if (transitions) takeTransitionHooks(instance.block, transitions)
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
  if (transitions) {
    transitions.forEach((hooks, state) => {
      if (!state) {
        // vdom hooks belong to the vnode, not to the element they sit on
        const root = getRootElement(instance.block) as
          | TransitionBlock
          | undefined
        if (root) root.$transition = hooks
      } else if (!state.isUnmounting) {
        // the owning Transition is still there: it resolves its content again
        state.refresh!(hooks)
      }
    })
  }
}

// keyed by the state of the Transition that applied them; vdom hooks have none
type TakenTransitions = Map<
  VaporTransitionState | undefined,
  VaporTransitionHooks
>

// The same descent as `remove`: every node it would run a leave on.
function takeTransitionHooks(block: Block, taken: TakenTransitions): void {
  if (isArray(block)) {
    for (const b of block) takeTransitionHooks(b, taken)
  } else if (isVaporComponent(block)) {
    // a pending async setup has no block yet
    if (block.block) takeTransitionHooks(block.block, taken)
  } else {
    const hooks = (block as TransitionBlock).$transition
    if (hooks) {
      ;(block as TransitionBlock).$transition = undefined
      taken.set(hooks.state, hooks)
    }
    if (isFragment(block)) takeTransitionHooks(block.nodes, taken)
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
