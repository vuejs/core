import { proxyRefs } from '@vue/reactivity'
import { type Data, invokeArrayFns, isArray, isObject } from '@vue/shared'
import {
  type Component,
  type ComponentInternalInstance,
  createComponentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from './component'
import { initProps } from './componentProps'
import { invokeDirectiveHook } from './directive'
import { insert, querySelector, remove } from './dom'
import { queuePostRenderEffect } from './scheduler'

export const fragmentKey = Symbol(__DEV__ ? `fragmentKey` : ``)

export type Block = Node | Fragment | Block[]
export type ParentBlock = ParentNode | Block[]
export type Fragment = {
  nodes: Block
  anchor?: Node
  [fragmentKey]: true
}

export function render(
  comp: Component,
  props: Data,
  container: string | ParentNode,
): ComponentInternalInstance {
  const instance = createComponentInstance(comp, props)
  initProps(instance, props)
  return mountComponent(instance, (container = normalizeContainer(container)))
}

export function normalizeContainer(container: string | ParentNode): ParentNode {
  return typeof container === 'string'
    ? (querySelector(container) as ParentNode)
    : container
}

export function mountComponent(
  instance: ComponentInternalInstance,
  container: ParentNode,
) {
  instance.container = container

  const reset = setCurrentInstance(instance)
  const block = instance.scope.run(() => {
    const { component, props, emit } = instance
    const ctx = { expose: () => {}, emit }

    const setupFn =
      typeof component === 'function' ? component : component.setup
    const stateOrNode = setupFn && setupFn(props, ctx)

    let block: Block | undefined

    if (
      stateOrNode &&
      (stateOrNode instanceof Node ||
        isArray(stateOrNode) ||
        (stateOrNode as any)[fragmentKey])
    ) {
      block = stateOrNode as Block
    } else if (isObject(stateOrNode)) {
      instance.setupState = proxyRefs(stateOrNode)
    }
    if (!block && component.render) {
      block = component.render(instance.setupState)
    }

    if (block instanceof DocumentFragment) {
      block = Array.from(block.childNodes)
    }
    if (!block) {
      // TODO: warn no template
      block = []
    }
    return (instance.block = block)
  })!
  const { bm, m } = instance

  // hook: beforeMount
  bm && invokeArrayFns(bm)
  invokeDirectiveHook(instance, 'beforeMount')

  insert(block, instance.container)
  instance.isMounted = true

  // hook: mounted
  queuePostRenderEffect(() => {
    invokeDirectiveHook(instance, 'mounted')
    m && invokeArrayFns(m)
  })
  reset()

  return instance
}

export function unmountComponent(instance: ComponentInternalInstance) {
  const { container, block, scope, um, bum } = instance

  // hook: beforeUnmount
  bum && invokeArrayFns(bum)
  invokeDirectiveHook(instance, 'beforeUnmount')

  scope.stop()
  block && remove(block, container)
  instance.isMounted = false
  instance.isUnmounted = true

  // hook: unmounted
  invokeDirectiveHook(instance, 'unmounted')
  um && invokeArrayFns(um)
  unsetCurrentInstance()
}
