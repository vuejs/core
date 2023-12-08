import { reactive } from '@vue/reactivity'
import {
  type ComponentInternalInstance,
  type FunctionalComponent,
  type ObjectComponent,
  createComponentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from './component'
import { invokeDirectiveHook } from './directive'
import { insert, remove } from './dom'

export type Block = Node | Fragment | Block[]
export type ParentBlock = ParentNode | Node[]
export type Fragment = { nodes: Block; anchor: Node }
export type BlockFn = (props: any, ctx: any) => Block

export function render(
  comp: ObjectComponent | FunctionalComponent,
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

export function mountComponent(
  instance: ComponentInternalInstance,
  container: ParentNode,
) {
  instance.container = container

  setCurrentInstance(instance)
  const block = instance.scope.run(() => {
    const { component } = instance
    const props = {}
    const ctx = { expose: () => {} }

    const setupFn =
      typeof component === 'function' ? component : component.setup

    const state = setupFn(props, ctx)
    if (state && '__isScriptSetup' in state) {
      return (instance.block = component.render(reactive(state)))
    } else {
      return (instance.block = state as Block)
    }
  })!

  invokeDirectiveHook(instance, 'beforeMount')
  insert(block, instance.container)
  instance.isMountedRef.value = true
  invokeDirectiveHook(instance, 'mounted')

  // TODO: lifecycle hooks (mounted, ...)
  // const { m } = instance
  // m && invoke(m)
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
