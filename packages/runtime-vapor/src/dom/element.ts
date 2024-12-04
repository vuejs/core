import { isArray } from '@vue/shared'
import type { Block } from '../apiRender'
import { componentKey } from '../component'
import { renderEffect } from '../renderEffect'
import { setText } from './prop'

/*! #__NO_SIDE_EFFECTS__ */
export function normalizeBlock(block: Block): Node[] {
  const nodes: Node[] = []
  if (block instanceof Node) {
    nodes.push(block)
  } else if (isArray(block)) {
    block.forEach(child => nodes.push(...normalizeBlock(child)))
  } else if (componentKey in block) {
    nodes.push(...normalizeBlock(block.block!))
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
): void {
  const nodes = normalizeBlock(block)
  for (let i = 0; i < nodes.length; i++) {
    parent.insertBefore(nodes[i], anchor)
  }
}

export function prepend(parent: ParentNode, ...blocks: Block[]): void {
  parent.prepend(...normalizeBlock(blocks))
}

export function remove(block: Block, parent: ParentNode): void {
  const nodes = normalizeBlock(block)
  for (let i = 0; i < nodes.length; i++) {
    parent.removeChild(nodes[i])
  }
}

export function createTextNode(values?: any[] | (() => any[])): Text {
  // eslint-disable-next-line no-restricted-globals
  const node = document.createTextNode('')
  if (values)
    if (isArray(values)) {
      setText(node, ...values)
    } else {
      renderEffect(() => setText(node, ...values()))
    }
  return node
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
