import {
  MismatchTypes,
  type VShowElement,
  logMismatchError,
  vShowHidden,
  vShowOriginalDisplay,
  warn,
  warnPropMismatch,
} from '@vue/runtime-dom'
import { setActiveSub } from '@vue/reactivity'
import { renderEffect } from '../renderEffect'
import { type RootChainVisitor, getRootElement } from '../component'
import {
  type Block,
  type TransitionBlock,
  type VaporTransitionHooks,
  isValidBlock,
} from '../block'
import { isHydrating } from '../dom/hydration'
import { isInteropEnabled } from '../vdomInteropState'
import { isTransitionEnabled } from '../transition'
import { isSuspenseEnabled } from '../suspense'

/**
 * v-show is root-inherited state: it lands on the effective root element of
 * `target`, and any producer on the root chain (dynamic fragment branch,
 * interop subtree, pending async setup) can replace that root later. `apply`
 * resolves the root through the shared chain walker and registers itself on
 * every producer it passes, so a replacement root re-enters `apply` and
 * registers the producers inside it in turn.
 */
export function applyVShow(target: Block, source: () => any): void {
  let value: unknown
  let transition: VaporTransitionHooks | undefined
  // the chain ends in content that does not exist yet; not a shape warning
  let unresolved = false

  const visitor: RootChainVisitor = {
    onComponent(instance) {
      if (
        __FEATURE_SUSPENSE__ &&
        isSuspenseEnabled &&
        instance.asyncDep &&
        !instance.asyncResolved
      ) {
        // the block exists only after setup settles; its mount runs `bm`
        // before insertion. The mark doubles as the registration guard.
        if (!(instance as TransitionBlock).$vshow) {
          ;(instance.bm ||= []).push(() => apply(instance.block))
        }
        unresolved = true
        mark(instance)
        return true
      }
      mark(instance)
    },
    onDynamicFragment(frag) {
      mark(frag)
      register((frag.bm ||= []), apply)
    },
  }
  if (isInteropEnabled) {
    visitor.onInteropFragment = frag => {
      mark(frag)
      if (isTransitionEnabled && frag.$transition) transition = frag.$transition
      // vdom patches the content first, then notifies through `u`
      register((frag.u ||= []), apply)
      if (!isValidBlock(frag.nodes)) unresolved = true
    }
  }

  const apply = (nodes: Block): void => {
    transition = undefined
    unresolved = false
    const root = getRootElement(nodes, visitor)
    if (root) {
      setDisplay(root as VShowElement, value, transition)
    } else if (__DEV__ && !unresolved && isValidBlock(nodes)) {
      warn(
        `v-show used on component with non-single-element root node ` +
          `and will be ignored.`,
      )
    }
  }

  renderEffect(() => {
    value = source()
    apply(target)
  })
}

function mark(block: Block): void {
  ;(block as TransitionBlock).$vshow = true
}

function register(hooks: ((nodes: Block) => void)[], hook: (typeof hooks)[0]) {
  if (!hooks.includes(hook)) hooks.push(hook)
}

function setDisplay(
  el: VShowElement,
  value: unknown,
  transition: VaporTransitionHooks | undefined,
): void {
  const hidden = !value
  if (!(vShowOriginalDisplay in el)) {
    // First touch, before insertion: only record the display state and
    // mark the element as v-show-owned. The renderer owns enter on insert
    // (vdom's directive beforeMount/mounted role), so no transition runs.
    mark(el)
    el[vShowOriginalDisplay] =
      el.style.display === 'none' ? '' : el.style.display
    el[vShowHidden] = hidden
    writeDisplay(el, value)
    return
  }

  if (el[vShowHidden] === hidden) return
  el[vShowHidden] = hidden

  const $transition = isTransitionEnabled
    ? (el as TransitionBlock).$transition || transition
    : undefined
  if ($transition) {
    const prevSub = setActiveSub()
    try {
      if (value) {
        $transition.beforeEnter(el)
        el.style.display = el[vShowOriginalDisplay]!
        $transition.enter(el)
      } else if (el.isConnected) {
        $transition.leave(el, () => {
          el.style.display = 'none'
        })
      } else {
        // detached (e.g. deactivated): nothing to animate
        el.style.display = 'none'
      }
    } finally {
      setActiveSub(prevSub)
    }
  } else {
    writeDisplay(el, value)
  }
}

function writeDisplay(el: VShowElement, value: unknown): void {
  if ((__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) && isHydrating) {
    // the SSR display state only counts as a mismatch when it disagrees
    // with the client value in either direction
    const hidden = el.style.display === 'none'
    if (!value === hidden) return
    const expected = value ? el[vShowOriginalDisplay]! : 'none'
    const hasMismatch = warnPropMismatch(
      el,
      'style',
      MismatchTypes.STYLE,
      `display: ${el.style.display}`,
      expected ? `display: ${expected}` : false,
    )
    if (hasMismatch) {
      logMismatchError()
      el.style.display = value ? el[vShowOriginalDisplay]! : 'none'
    }
  } else {
    el.style.display = value ? el[vShowOriginalDisplay]! : 'none'
  }
}
