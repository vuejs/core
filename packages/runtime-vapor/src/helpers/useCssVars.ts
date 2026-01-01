import {
  type GenericComponentInstance,
  baseUseCssVars,
  currentInstance,
  setVarsOnNode,
} from '@vue/runtime-dom'
import { type VaporComponentInstance, isVaporComponent } from '../component'
import { isArray } from '@vue/shared'
import type { Block } from '../block'

export function useVaporCssVars(getter: () => Record<string, string>): void {
  if (!__BROWSER__ && !__TEST__) return
  const instance = currentInstance as VaporComponentInstance
  baseUseCssVars(
    instance,
    () => resolveParentNode(instance.block),
    getter,
    vars => setVars(instance, vars),
  )
}

function resolveParentNode(block: Block): Node {
  if (block instanceof Node) {
    return block.parentNode!
  } else if (isArray(block)) {
    // Use the last element, so ForFragment will use the anchor
    return resolveParentNode(block[block.length - 1])
  } else if (isVaporComponent(block)) {
    return resolveParentNode(block.block!)
  } else {
    return resolveParentNode(block.anchor || block.nodes)
  }
}

function setVars(
  instance: VaporComponentInstance,
  vars: Record<string, string>,
): void {
  if ((instance as GenericComponentInstance).ce) {
    setVarsOnNode((instance as GenericComponentInstance).ce as any, vars)
  } else {
    setVarsOnBlock(instance.block, vars)
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
