import { isArray, isFunction, isObject } from '@vue/shared'
import {
  type ComponentInternalInstance,
  componentKey,
  setCurrentInstance,
} from './component'
import { insert, querySelector, remove } from './dom/element'
import { flushPostFlushCbs, queuePostRenderEffect } from './scheduler'
import { proxyRefs } from '@vue/reactivity'
import { invokeLifecycle } from './componentLifecycle'
import { VaporLifecycleHooks } from './apiLifecycle'
import { fallThroughAttrs } from './componentAttrs'

export const fragmentKey = Symbol(__DEV__ ? `fragmentKey` : ``)

export type Block = Node | Fragment | ComponentInternalInstance | Block[]
export type Fragment = {
  nodes: Block
  anchor?: Node
  [fragmentKey]: true
}

export function setupComponent(
  instance: ComponentInternalInstance,
  singleRoot: boolean = false,
): void {
  const reset = setCurrentInstance(instance)
  instance.scope.run(() => {
    const { component, props, emit, attrs } = instance
    const ctx = { expose: () => {}, emit, attrs }

    const setupFn = isFunction(component) ? component : component.setup
    const stateOrNode = setupFn && setupFn(props, ctx)

    let block: Block | undefined

    if (
      stateOrNode &&
      (stateOrNode instanceof Node ||
        isArray(stateOrNode) ||
        fragmentKey in stateOrNode ||
        componentKey in stateOrNode)
    ) {
      block = stateOrNode
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
    instance.block = block
    if (singleRoot) fallThroughAttrs(instance)
    return block
  })
  reset()
}

export function render(
  instance: ComponentInternalInstance,
  container: string | ParentNode,
): void {
  mountComponent(instance, (container = normalizeContainer(container)))
  flushPostFlushCbs()
}

function normalizeContainer(container: string | ParentNode): ParentNode {
  return typeof container === 'string'
    ? (querySelector(container) as ParentNode)
    : container
}

function mountComponent(
  instance: ComponentInternalInstance,
  container: ParentNode,
) {
  instance.container = container

  // hook: beforeMount
  invokeLifecycle(instance, VaporLifecycleHooks.BEFORE_MOUNT, 'beforeMount')

  insert(instance.block!, instance.container)
  instance.isMounted = true

  // hook: mounted
  invokeLifecycle(instance, VaporLifecycleHooks.MOUNTED, 'mounted', true)

  return instance
}

export function unmountComponent(instance: ComponentInternalInstance) {
  const { container, block, scope } = instance

  // hook: beforeUnmount
  invokeLifecycle(instance, VaporLifecycleHooks.BEFORE_UNMOUNT, 'beforeUnmount')

  scope.stop()
  block && remove(block, container)

  // hook: unmounted
  invokeLifecycle(instance, VaporLifecycleHooks.UNMOUNTED, 'unmounted', true)
  queuePostRenderEffect(() => (instance.isUnmounted = true))
}
