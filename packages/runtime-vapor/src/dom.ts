import { isArray, toDisplayString } from '@vue/shared'
import type { Block, ParentBlock } from './render'

export * from './dom/style'
export * from './dom/prop'
export * from './dom/event'
export * from './dom/templateRef'

/*! #__NO_SIDE_EFFECTS__ */
export function normalizeBlock(block: Block): Node[] {
  const nodes: Node[] = []
  if (block instanceof Node) {
    nodes.push(block)
  } else if (isArray(block)) {
    block.forEach(child => nodes.push(...normalizeBlock(child)))
  } else if (block) {
    nodes.push(...normalizeBlock(block.nodes))
    block.anchor && nodes.push(block.anchor)
  }
  return nodes
}

export function insert(
  block: Block,
  parent: ParentBlock,
  anchor: Node | null = null,
) {
  if (isArray(parent)) {
    const index = anchor ? parent.indexOf(anchor) : -1
    if (index > -1) {
      parent.splice(index, 0, block)
    } else {
      if (anchor) throw new Error('The child can not be found in the parent.')
      parent.push(block)
    }
  } else {
    normalizeBlock(block).forEach(node => parent.insertBefore(node, anchor))
  }
}

export function prepend(parent: ParentBlock, ...blocks: Block[]) {
  if (isArray(parent)) {
    parent.unshift(...blocks)
  } else {
    parent.prepend(...normalizeBlock(blocks))
  }
}

export function append(parent: ParentBlock, ...blocks: Block[]) {
  if (isArray(parent)) {
    parent.push(...blocks)
  } else {
    parent.append(...normalizeBlock(blocks))
  }
}

export function remove(block: Block, parent: ParentBlock) {
  if (isArray(parent)) {
    const index = parent.indexOf(block)
    if (index === -1)
      throw Error('The node to be removed is not a child of this node.')
    parent.splice(index, 1)
  } else {
    normalizeBlock(block).forEach(node => parent.removeChild(node))
  }
}

/*! #__NO_SIDE_EFFECTS__ */
export function children(node: Node | Node[], ...paths: number[]): Node {
  for (const idx of paths) {
    node = isArray(node) ? node[idx] : node.childNodes[idx]
  }
  return node as Node
}

/*! #__NO_SIDE_EFFECTS__ */
export function createTextNode(val?: unknown): Text {
  // eslint-disable-next-line no-restricted-globals
  return document.createTextNode(val === undefined ? '' : toDisplayString(val))
}

/*! #__NO_SIDE_EFFECTS__ */
export function createComment(data: string): Comment {
  // eslint-disable-next-line no-restricted-globals
  return document.createComment(data)
}

/*! #__NO_SIDE_EFFECTS__ */
export function querySelector(selectors: string): Element | null {
  // eslint-disable-next-line no-restricted-globals
  return document.querySelector(selectors)
}
