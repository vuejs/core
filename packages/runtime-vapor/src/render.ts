import {
  isArray,
  normalizeClass,
  normalizeStyle,
  toDisplayString,
} from '@vue/shared'
import {
  ComponentInternalInstance,
  createComponentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from './component'
import { invokeDirectiveHook } from './directives'

export type Block = Node | Fragment | Block[]
export type ParentBlock = ParentNode | Node[]
export type Fragment = { nodes: Block; anchor: Node }
export type BlockFn = (props?: any) => Block

export function render(
  comp: BlockFn,
  container: string | ParentNode,
): ComponentInternalInstance {
  const instance = createComponentInstance(comp)
  setCurrentInstance(instance)
  mountComponent(instance, (container = normalizeContainer(container)))
  return instance
}

export function normalizeContainer(container: string | ParentNode): ParentNode {
  return typeof container === 'string'
    ? (document.querySelector(container) as ParentNode)
    : container
}

export const mountComponent = (
  instance: ComponentInternalInstance,
  container: ParentNode,
) => {
  instance.container = container

  setCurrentInstance(instance)
  const block = instance.scope.run(
    () => (instance.block = instance.component()),
  )!

  invokeDirectiveHook(instance, 'beforeMount')
  insert(block, instance.container)
  instance.isMounted = true
  invokeDirectiveHook(instance, 'mounted')

  // TODO: lifecycle hooks (mounted, ...)
  // const { m } = instance
  // m && invoke(m)
}

export const unmountComponent = (instance: ComponentInternalInstance) => {
  const { container, block, scope } = instance

  invokeDirectiveHook(instance, 'beforeUnmount')
  scope.stop()
  block && remove(block, container)
  instance.isMounted = false
  invokeDirectiveHook(instance, 'unmounted')
  unsetCurrentInstance()

  // TODO: lifecycle hooks (unmounted, ...)
  // const { um } = instance
  // um && invoke(um)
}

export function insert(
  block: Block,
  parent: ParentNode,
  anchor: Node | null = null,
) {
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
  if (block instanceof Node) {
    parent.removeChild(block)
  } else if (isArray(block)) {
    for (const child of block) remove(child, parent)
  } else {
    remove(block.nodes, parent)
    block.anchor && parent.removeChild(block.anchor)
  }
}

export function setText(el: Element, oldVal: any, newVal: any) {
  if ((newVal = toDisplayString(newVal)) !== oldVal) {
    el.textContent = newVal
  }
}

export function setHtml(el: Element, oldVal: any, newVal: any) {
  if (newVal !== oldVal) {
    el.innerHTML = newVal
  }
}

export function setClass(el: Element, oldVal: any, newVal: any) {
  if ((newVal = normalizeClass(newVal)) !== oldVal && (newVal || oldVal)) {
    el.className = newVal
  }
}

export function setStyle(el: HTMLElement, oldVal: any, newVal: any) {
  if ((newVal = normalizeStyle(newVal)) !== oldVal && (newVal || oldVal)) {
    if (typeof newVal === 'string') {
      el.style.cssText = newVal
    } else {
      // TODO
    }
  }
}

export function setAttr(el: Element, key: string, oldVal: any, newVal: any) {
  if (newVal !== oldVal) {
    if (newVal != null) {
      el.setAttribute(key, newVal)
    } else {
      el.removeAttribute(key)
    }
  }
}

export function setDynamicProp(el: Element, key: string, val: any) {
  if (key === 'class') {
    setClass(el, void 0, val)
  } else if (key === 'style') {
    setStyle(el as HTMLElement, void 0, val)
  } else if (key in el) {
    ;(el as any)[key] = val
  } else {
    // TODO special checks
    setAttr(el, key, void 0, val)
  }
}

type Children = Record<number, [ChildNode, Children]>
export function children(n: ChildNode): Children {
  return { ...Array.from(n.childNodes).map((n) => [n, children(n)]) }
}

export function createTextNode(val: unknown): Text {
  return document.createTextNode(toDisplayString(val))
}
