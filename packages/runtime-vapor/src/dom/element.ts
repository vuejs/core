import { isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect'
import { setText } from './prop'
import { type Block, normalizeBlock } from '../block'
import { isVaporComponent } from '../component'

export function insert(
  block: Block,
  parent: ParentNode,
  anchor: Node | null = null,
): void {
  if (block instanceof Node) {
    parent.insertBefore(block, anchor)
  } else if (isVaporComponent(block)) {
    insert(block.block, parent, anchor)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      insert(block[i], parent, anchor)
    }
  } else {
    // fragment
    insert(block.nodes, parent, anchor)
  }
}

export function prepend(parent: ParentNode, ...blocks: Block[]): void {
  const anchor = parent.firstChild
  for (const b of blocks) insert(b, parent, anchor)
}

// TODO optimize
export function remove(block: Block, parent: ParentNode): void {
  const nodes = normalizeBlock(block)
  for (let i = 0; i < nodes.length; i++) {
    parent.removeChild(nodes[i])
  }
}

// TODO optimize
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
