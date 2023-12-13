import { markRaw, proxyRefs } from '@vue/reactivity'
import { type Data } from '@vue/shared'

import {
  type Component,
  type ComponentInternalInstance,
  createComponentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from './component'

import { initProps } from './componentProps'

import { invokeDirectiveHook } from './directive'

import { insert, remove } from './dom'
import { PublicInstanceProxyHandlers } from './componentPublicInstance'

export type Block = Node | Fragment | Block[]
export type ParentBlock = ParentNode | Node[]
export type Fragment = { nodes: Block; anchor: Node }
export type BlockFn = (props: any, ctx: any) => Block

export function render(
  comp: Component,
  props: Data,
  container: string | ParentNode,
): ComponentInternalInstance {
  const instance = createComponentInstance(comp)
  initProps(instance, props)
  return mountComponent(instance, (container = normalizeContainer(container)))
}

export function normalizeContainer(container: string | ParentNode): ParentNode {
  return typeof container === 'string'
    ? (document.querySelector(container) as ParentNode)
    : container
}

export function mountComponent(
  instance: ComponentInternalInstance,
  container: ParentNode,
) {
  instance.container = container

  setCurrentInstance(instance)
  const block = instance.scope.run(() => {
    const { component, props } = instance
    const ctx = { expose: () => {} }

    const setupFn =
      typeof component === 'function' ? component : component.setup
    instance.proxy = markRaw(
      new Proxy({ _: instance }, PublicInstanceProxyHandlers),
    )
    const state = setupFn && setupFn(props, ctx)
    if (state && '__isScriptSetup' in state) {
      instance.setupState = proxyRefs(state)
      return (instance.block = component.render(instance.proxy))
    } else {
      return (instance.block = state as Block)
    }
  })!
  invokeDirectiveHook(instance, 'beforeMount')
  insert(block, instance.container)
  instance.isMountedRef.value = true
  invokeDirectiveHook(instance, 'mounted')
  unsetCurrentInstance()

  // TODO: lifecycle hooks (mounted, ...)
  // const { m } = instance
  // m && invoke(m)

  return instance
}

export function unmountComponent(instance: ComponentInternalInstance) {
  const { container, block, scope } = instance

  invokeDirectiveHook(instance, 'beforeUnmount')
  scope.stop()
  block && remove(block, container)
  instance.isMountedRef.value = false
  invokeDirectiveHook(instance, 'unmounted')
  unsetCurrentInstance()

  // TODO: lifecycle hooks (unmounted, ...)
  // const { um } = instance
  // um && invoke(um)
}
