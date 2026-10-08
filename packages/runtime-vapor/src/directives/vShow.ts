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
import {
  type RootChainVisitor,
  type VaporComponentInstance,
  getRootElement,
} from '../component'
import {
  type Block,
  type TransitionBlock,
  VShowFlags,
  type VaporTransitionHooks,
  isValidBlock,
} from '../block'
import { isSlotOutletFragment } from '../fragment'
import { isHydrating } from '../dom/hydration'
import { isInteropEnabled } from '../vdomInteropState'
import { isInteropVShowPending, setInteropVShow } from '../vdomInterop'
import { isTransitionEnabled, isVaporTransition } from '../transition'
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
  // a slot outlet is a fragment root in vdom: nothing for v-show to land on
  let slotRoot = false
  // ...except on Transition's own root chain: vdom flattens the slot
  // fragment into Transition's child. Any other component ends that chain.
  let inTransition: boolean | undefined
  // the binding has run once: later runs update the root, a producer's
  // re-entry initializes the root it rendered
  let ran = false
  // ...unless that root is a kept-alive component back from the cache with
  // the state this binding left on it (vdom re-patches it: `updated`)
  let updating: boolean | undefined
  // pending async setups this binding already waits on
  let pendingSetups: WeakSet<VaporComponentInstance> | undefined
  let applyInTransition: ((nodes: Block) => void) | undefined

  const visitor: RootChainVisitor = {
    onComponent(instance) {
      if (__DEV__) register((instance.hmrRootHooks ||= []), apply)
      if (
        __FEATURE_SUSPENSE__ &&
        isSuspenseEnabled &&
        instance.asyncDep &&
        !instance.asyncResolved
      ) {
        // the block exists only after setup settles; its mount runs `bm`
        // before insertion
        if (!(pendingSetups ||= new WeakSet()).has(instance)) {
          pendingSetups.add(instance)
          ;(instance.bm ||= []).push(() => apply(instance.block))
        }
        unresolved = true
        return true
      }
      if (instance.isDeactivated) updating = true
      inTransition = isTransitionEnabled && isVaporTransition(instance.type)
    },
    onDynamicFragment(frag) {
      if (!inTransition && isSlotOutletFragment(frag)) return (slotRoot = true)
      // a branch swapped on Transition's root chain re-enters with that context
      register(
        (frag.bm ||= []),
        inTransition
          ? (applyInTransition ||= nodes => apply(nodes, false, true))
          : apply,
      )
    },
  }
  if (isInteropEnabled) {
    visitor.onInteropFragment = frag => {
      if (isSlotOutletFragment(frag)) return (slotRoot = true)
      if (frag.vnode) setInteropVShow(frag, apply)
      if (isTransitionEnabled && frag.$transition) transition = frag.$transition
      // vdom patches the content first, then notifies through `u`
      register((frag.u ||= []), apply)
      if (!isValidBlock(frag.nodes)) unresolved = true
    }
  }

  const apply = (nodes: Block, update?: boolean, transitionSlot?: boolean) => {
    transition = undefined
    unresolved = slotRoot = false
    updating = update
    inTransition = transitionSlot
    const root = getRootElement(nodes, visitor)
    if (root) {
      setDisplay(root as VShowElement, value, transition, updating)
    } else if (__DEV__ && (slotRoot || (!unresolved && isValidBlock(nodes)))) {
      warn(
        `v-show used on component with non-single-element root node ` +
          `and will be ignored.`,
      )
    }
  }

  ;(target as TransitionBlock).$vshow! |= VShowFlags.TARGET
  renderEffect(() => {
    value = source()
    apply(target, ran)
    ran = true
  })
}

function register<T>(hooks: T[], hook: T): void {
  if (!hooks.includes(hook)) hooks.push(hook)
}

function setDisplay(
  el: VShowElement,
  value: unknown,
  transition: VaporTransitionHooks | undefined,
  updating: boolean | undefined,
): void {
  const hidden = !value
  if (!(vShowOriginalDisplay in el)) {
    // First touch, before insertion: only record the display state and
    // mark the element as v-show-owned. The renderer owns enter on insert
    // (vdom's directive beforeMount/mounted role), so no transition runs.
    ;(el as TransitionBlock).$vshow! |= VShowFlags.APPLIED
    el[vShowOriginalDisplay] =
      el.style.display === 'none' ? '' : el.style.display
    writeDisplay(el, value)
    return
  }

  if (el[vShowHidden] === hidden) return

  // The VDOM mounted hook owns enter until Suspense releases the root.
  if (isInteropEnabled && isInteropVShowPending(el)) {
    writeDisplay(el, value)
    return
  }

  const $transition = isTransitionEnabled
    ? (el as TransitionBlock).$transition || transition
    : undefined
  if (updating) {
    ;(el as TransitionBlock).$vshow! &= ~VShowFlags.MOUNT_SHOWN
    if ($transition) {
      el[vShowHidden] = hidden
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
      return
    }
  } else if (value) {
    // Another v-show reaching the element before insertion (vdom's
    // beforeMount): a shown transition root stays as the first one left it,
    // the renderer still enters it on insert. Shown with no hooks yet, the
    // Transition that attaches them re-hides it.
    ;(el as TransitionBlock).$vshow! |= VShowFlags.MOUNT_SHOWN
    if ($transition) return
  }
  writeDisplay(el, value)
}

function writeDisplay(el: VShowElement, value: unknown): void {
  el[vShowHidden] = !value
  if ((__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) && isHydrating) {
    // the SSR display state only counts as a mismatch when it disagrees
    // with the client value in either direction
    const hidden = el.style.display === 'none'
    if (!value === hidden) return
    const expected = value ? el[vShowOriginalDisplay]! : 'none'
    if (
      warnPropMismatch(
        el,
        'style',
        MismatchTypes.STYLE,
        `display: ${el.style.display}`,
        expected ? `display: ${expected}` : false,
      )
    ) {
      logMismatchError()
    }
  }
  el.style.display = value ? el[vShowOriginalDisplay]! : 'none'
}
