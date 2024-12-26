import {
  applyCssVars,
  currentInstance,
  setVarsOnNode,
  warn,
} from '@vue/runtime-dom'
import { type VaporComponentInstance, isVaporComponent } from './component'
import { isArray } from '@vue/shared'
import type { Block } from './block'

export function vaporUseCssVars(getter: () => Record<string, string>): void {
  if (!__BROWSER__ && !__TEST__) return

  const instance = currentInstance as VaporComponentInstance
  /* v8 ignore start */
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }
  /* v8 ignore stop */

  applyCssVars(
    () => resolveParentNode(instance.block),
    () => setVarsOnBlock(instance.block, getter()),
  )
}

function resolveParentNode(block: Block): Node {
  if (block instanceof Node) {
    return block.parentNode!
  } else if (isVaporComponent(block)) {
    return resolveParentNode(block.block!)
  } else if (isArray(block)) {
    return resolveParentNode(block[0])
  } else {
    return resolveParentNode(block.nodes)
  }
}

function setVarsOnBlock(block: Block, vars: Record<string, string>): void {
  if (block instanceof Node) {
    setVarsOnNode(block, vars)
  } else if (isArray(block)) {
    block.forEach(child => setVarsOnBlock(child, vars))
  } else if (isVaporComponent(block)) {
    setVarsOnBlock(block.block!, vars)
  } else {
    setVarsOnBlock(block.nodes, vars)
  }
}
