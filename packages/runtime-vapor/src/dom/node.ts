import { isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect'
import { setText } from './prop'
import type { Block } from '../block'
import {
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from '../component'

export function insert(
  block: Block,
  parent: ParentNode,
  anchor: Node | null | 0 = null,
): void {
  if (block instanceof Node) {
    parent.insertBefore(block, anchor === 0 ? parent.firstChild : anchor)
  } else if (isVaporComponent(block)) {
    mountComponent(block, parent, anchor)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      insert(block[i], parent, anchor)
    }
  } else {
    // fragment
    insert(block.nodes, parent, anchor)
    if (block.anchor) insert(block.anchor, parent, anchor)
  }
}

export function prepend(parent: ParentNode, ...blocks: Block[]): void {
  for (const b of blocks) insert(b, parent, 0)
}

// TODO invoke unmount recursive
export function remove(block: Block, parent: ParentNode): void {
  if (block instanceof Node) {
    parent.removeChild(block)
  } else if (isVaporComponent(block)) {
    unmountComponent(block, parent)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      remove(block[i], parent)
    }
  } else {
    // fragment
    remove(block.nodes, parent)
    if (block.anchor) remove(block.anchor, parent)
  }
}

export function createTextNode(values?: any[] | (() => any[])): Text {
  // eslint-disable-next-line no-restricted-globals
  const node = document.createTextNode('')
  if (values) {
    if (isArray(values)) {
      setText(node, ...values)
    } else {
      renderEffect(() => setText(node, ...values()))
    }
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
