import { isArray, toDisplayString } from '@vue/shared'
import type { Block, ParentBlock } from './render'

export * from './dom/patchProp'
export * from './dom/templateRef'

export function insert(block: Block, parent: Node, anchor: Node | null = null) {
  // if (!isHydrating) {
  if (block instanceof Node) {
    parent.insertBefore(block, anchor)
  } else if (isArray(block)) {
    for (const child of block) insert(child, parent, anchor)
  } else {
    insert(block.nodes, parent, anchor)
    parent.insertBefore(block.anchor, anchor)
  }
  // }
}

export function prepend(parent: ParentBlock, ...nodes: Node[]) {
  if (parent instanceof Node) {
    // TODO use insertBefore for better performance https://jsbench.me/rolpg250hh/1
    parent.prepend(...nodes)
  } else if (isArray(parent)) {
    parent.unshift(...nodes)
  }
}

export function append(parent: ParentBlock, ...nodes: Node[]) {
  if (parent instanceof Node) {
    // TODO use insertBefore for better performance
    parent.append(...nodes)
  } else if (isArray(parent)) {
    parent.push(...nodes)
  }
}

export function remove(block: Block, parent: ParentNode) {
  if (block instanceof DocumentFragment) {
    remove(Array.from(block.childNodes), parent)
  } else if (block instanceof Node) {
    parent.removeChild(block)
  } else if (isArray(block)) {
    for (const child of block) remove(child, parent)
  } else {
    remove(block.nodes, parent)
    block.anchor && parent.removeChild(block.anchor)
  }
}

export function setText(el: Node, oldVal: any, newVal: any) {
  if ((newVal = toDisplayString(newVal)) !== oldVal) {
    el.textContent = newVal
  }
}

export function setHtml(el: Element, oldVal: any, newVal: any) {
  if (newVal !== oldVal) {
    el.innerHTML = newVal
  }
}

type Children = Record<number, [ChildNode, Children]>
export function children(n: Node): Children {
  const result: Children = {}
  const array = Array.from(n.childNodes)
  for (let i = 0; i < array.length; i++) {
    const n = array[i]
    result[i] = [n, children(n)]
  }
  return result
}

export function createTextNode(val: unknown): Text {
  // eslint-disable-next-line no-restricted-globals
  return document.createTextNode(toDisplayString(val))
}
