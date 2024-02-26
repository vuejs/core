import { isArray, toDisplayString } from '@vue/shared'
import type { Block } from '../render'

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
  parent: ParentNode,
  anchor: Node | null = null,
) {
  normalizeBlock(block).forEach(node => parent.insertBefore(node, anchor))
}

export function prepend(parent: ParentNode, ...blocks: Block[]) {
  parent.prepend(...normalizeBlock(blocks))
}

export function remove(block: Block, parent: ParentNode) {
  normalizeBlock(block).forEach(node => parent.removeChild(node))
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
