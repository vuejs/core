import {
  type GenericComponentInstance,
  currentInstance,
  onBeforeMount,
  onMounted,
  setVarsOnNode,
  watch,
} from '@vue/runtime-dom'
import { EMPTY_OBJ, NOOP, extend, isArray, remove } from '@vue/shared'
import { type VaporComponentInstance, isVaporComponent } from '../component'
import type { Block } from '../block'
import {
  type VaporFragment,
  isDynamicFragment,
  isForFragment,
  isFragment,
  isInteropFragment,
} from '../fragment'
import { isTeleportEnabled, isTeleportFragment } from '../teleport'
import { isInteropEnabled } from '../vdomInteropState'
import { isHydrating } from '../dom/hydration'

/**
 * Css vars are root-inherited state: the owner writes its root chain before
 * insertion, containers on that chain write the content they produce later
 * (`bm` hooks; `u` for vdom-owned interop content), and teleports are written
 * directly as outlets since their content leaves the chain.
 */
export function useVaporCssVars(getter: () => Record<string, string>): void {
  if (!__BROWSER__ && !__TEST__) return
  const instance = currentInstance as VaporComponentInstance
  if (__DEV__) (instance as GenericComponentInstance).getCssVars = getter

  let vars: Record<string, string> = EMPTY_OBJ
  const apply = (instance.applyCssVars = (nodes: Block) => {
    // hydrated content already carries the SSR values
    if (!isHydrating) setVarsOnBlock(nodes, vars)
    registerCssVarApply(nodes, apply)
  })

  const watchVars = () =>
    watch(
      () => {
        // the copy also tracks every key before any root element exists
        vars = extend({}, getter())
        if (instance.ce) {
          setVarsOnNode(instance.ce as any, vars)
        } else {
          setVarsOnBlock(instance.block, vars)
        }
        const outlets = instance.cssVarOutlets
        if (outlets) {
          for (let i = 0; i < outlets.length; i++) {
            setVarsOnBlock(outlets[i].nodes, vars)
          }
        }
      },
      NOOP,
      { flush: 'post' },
    )

  onBeforeMount(() => {
    // a custom element writes its host only (vars cascade into the shadow
    // tree from there), so nothing on the root chain needs them
    if (!instance.ce) registerCssVarApply(instance.block, apply)
  })
  // Hydrated roots already carry the SSR values: write after mount so the
  // dev style mismatch check (deferred to post flush) still sees them.
  if (isHydrating) onMounted(watchVars)
  else onBeforeMount(watchVars)
}

export function setVarsOnBlock(
  block: Block,
  vars: Record<string, string>,
): void {
  if (block instanceof Node) {
    setVarsOnNode(block, vars)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) setVarsOnBlock(block[i], vars)
  } else if (isVaporComponent(block)) {
    setVarsOnBlock(block.block, vars)
  } else if (
    isFragment(block) &&
    !(isTeleportEnabled && isTeleportFragment(block))
  ) {
    setVarsOnBlock(block.nodes, vars)
  }
}

function registerCssVarApply(
  block: Block,
  apply: (nodes: Block) => void,
): void {
  if (isArray(block)) {
    for (let i = 0; i < block.length; i++) registerCssVarApply(block[i], apply)
  } else if (isVaporComponent(block)) {
    registerCssVarApply(block.block, apply)
  } else if (
    isFragment(block) &&
    !(isTeleportEnabled && isTeleportFragment(block))
  ) {
    // only producers fire hooks: branches and rows before insertion, interop
    // content once vdom has patched it
    const hooks =
      isInteropEnabled && isInteropFragment(block)
        ? (block.u ||= [])
        : isDynamicFragment(block) || isForFragment(block)
          ? (block.bm ||= [])
          : undefined
    if (hooks && !hooks.includes(apply)) hooks.push(apply)
    registerCssVarApply(block.nodes, apply)
  }
}

export function registerCssVarOutlet(
  owner: VaporComponentInstance,
  frag: VaporFragment,
): void {
  ;(owner.cssVarOutlets ||= []).push(frag)
  ;(frag.bum ||= []).push(() => remove(owner.cssVarOutlets!, frag))
}

// HMR: a rerendered block re-enters every owner chain passing through it
export function applyComponentCssVars(instance: VaporComponentInstance): void {
  let current: GenericComponentInstance | null = instance
  while (current && current.vapor) {
    const owner = current as VaporComponentInstance
    if (owner.applyCssVars && !owner.ce) owner.applyCssVars(owner.block)
    current = current.parent
  }
}
