import { isArray } from '@vue/shared'
import { type VaporComponentInstance, isVaporComponent } from './component'

export const fragmentKey: unique symbol = Symbol(__DEV__ ? `fragmentKey` : ``)

export type Block = Node | Fragment | VaporComponentInstance | Block[]
export type Fragment = {
  nodes: Block
  anchor?: Node
  [fragmentKey]: true
}

export function isFragment(val: NonNullable<unknown>): val is Fragment {
  return fragmentKey in val
}

export function isBlock(val: NonNullable<unknown>): val is Block {
  return (
    val instanceof Node ||
    isArray(val) ||
    isVaporComponent(val) ||
    isFragment(val)
  )
}

/*! #__NO_SIDE_EFFECTS__ */
// TODO this should be optimized away
export function normalizeBlock(block: Block): Node[] {
  const nodes: Node[] = []
  if (block instanceof Node) {
    nodes.push(block)
  } else if (isArray(block)) {
    block.forEach(child => nodes.push(...normalizeBlock(child)))
  } else if (isVaporComponent(block)) {
    nodes.push(...normalizeBlock(block.block!))
  } else if (block) {
    nodes.push(...normalizeBlock(block.nodes))
    block.anchor && nodes.push(block.anchor)
  }
  return nodes
}

export function findFirstRootElement(
  instance: VaporComponentInstance,
): Element | undefined {
  const element = getFirstNode(instance.block)
  return element instanceof Element ? element : undefined
}

export function getFirstNode(block: Block | null): Node | undefined {
  if (!block || isVaporComponent(block)) return
  if (block instanceof Node) return block
  if (isArray(block)) {
    if (block.length === 1) {
      return getFirstNode(block[0])
    }
  } else {
    return getFirstNode(block.nodes)
  }
}

export function isValidBlock(block: Block): boolean {
  return (
    normalizeBlock(block).filter(node => !(node instanceof Comment)).length > 0
  )
}
