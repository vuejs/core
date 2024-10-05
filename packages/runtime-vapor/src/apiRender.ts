import {
  type ComponentInternalInstance,
  componentKey,
  createSetupContext,
  setCurrentInstance,
  validateComponentName,
} from './component'
import { insert, querySelector } from './dom/element'
import { flushPostFlushCbs, queuePostFlushCb } from './scheduler'
import { invokeLifecycle } from './componentLifecycle'
import { VaporLifecycleHooks } from './enums'
import {
  pauseTracking,
  proxyRefs,
  resetTracking,
  shallowReadonly,
} from '@vue/reactivity'
import { isArray, isFunction, isObject } from '@vue/shared'
import { fallThroughAttrs } from './componentAttrs'
import { VaporErrorCodes, callWithErrorHandling } from './errorHandling'
import { endMeasure, startMeasure } from './profiling'
import { devtoolsComponentAdded } from './devtools'

export const fragmentKey: unique symbol = Symbol(__DEV__ ? `fragmentKey` : ``)

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
  if (__DEV__) {
    startMeasure(instance, `init`)
  }
  const reset = setCurrentInstance(instance)
  instance.scope.run(() => {
    const { type: component, props } = instance

    if (__DEV__) {
      if (component.name) {
        validateComponentName(component.name, instance.appContext.config)
      }
    }

    const setupFn = isFunction(component) ? component : component.setup
    let stateOrNode: Block | undefined
    if (setupFn) {
      const setupContext = (instance.setupContext =
        setupFn && setupFn.length > 1 ? createSetupContext(instance) : null)
      pauseTracking()
      stateOrNode = callWithErrorHandling(
        setupFn,
        instance,
        VaporErrorCodes.SETUP_FUNCTION,
        [__DEV__ ? shallowReadonly(props) : props, setupContext],
      )
      resetTracking()
    }

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
      pauseTracking()
      block = callWithErrorHandling(
        component.render,
        instance,
        VaporErrorCodes.RENDER_FUNCTION,
        [instance.setupState],
      )
      resetTracking()
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
  if (__DEV__) {
    endMeasure(instance, `init`)
  }
}

export function render(
  instance: ComponentInternalInstance,
  container: string | ParentNode,
): void {
  mountComponent(instance, (container = normalizeContainer(container)))
  flushPostFlushCbs()
}

export function normalizeContainer(container: string | ParentNode): ParentNode {
  return typeof container === 'string'
    ? (querySelector(container) as ParentNode)
    : container
}

function mountComponent(
  instance: ComponentInternalInstance,
  container: ParentNode,
) {
  instance.container = container

  if (__DEV__) {
    startMeasure(instance, 'mount')
  }

  // hook: beforeMount
  invokeLifecycle(instance, VaporLifecycleHooks.BEFORE_MOUNT, 'beforeMount')

  insert(instance.block!, instance.container)

  // hook: mounted
  invokeLifecycle(
    instance,
    VaporLifecycleHooks.MOUNTED,
    'mounted',
    instance => (instance.isMounted = true),
    true,
  )

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsComponentAdded(instance)
  }

  if (__DEV__) {
    endMeasure(instance, 'mount')
  }

  return instance
}

export function unmountComponent(instance: ComponentInternalInstance): void {
  const { container, scope } = instance

  // hook: beforeUnmount
  invokeLifecycle(instance, VaporLifecycleHooks.BEFORE_UNMOUNT, 'beforeUnmount')

  scope.stop()
  container.textContent = ''

  // hook: unmounted
  invokeLifecycle(
    instance,
    VaporLifecycleHooks.UNMOUNTED,
    'unmounted',
    instance => queuePostFlushCb(() => (instance.isUnmounted = true)),
    true,
  )
  flushPostFlushCbs()
}
