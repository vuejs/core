import {
  EffectScope,
  ReactiveEffect,
  pauseTracking,
  resetTracking,
} from '@vue/reactivity'
import {
  type Component,
  type ComponentInternalInstance,
  SetupContext,
} from './component'
import { EMPTY_OBJ, NO, hasOwn, isFunction } from '@vue/shared'
import { type SchedulerJob, queueJob } from '../../runtime-core/src/scheduler'
import { insert } from './dom/element'
import { normalizeContainer } from './apiRender'
import { normalizePropsOptions } from './componentProps'

interface RawProps {
  [key: string]: any
  $?: DynamicPropsSource[]
}

type DynamicPropsSource = Record<string, any> | (() => Record<string, any>)

export function createComponentSimple(
  component: Component,
  rawProps?: RawProps,
): any {
  const instance = new ComponentInstance(
    component,
    rawProps,
  ) as any as ComponentInternalInstance

  pauseTracking()
  let prevInstance = currentInstance
  currentInstance = instance
  instance.scope.on()

  const setupFn = isFunction(component) ? component : component.setup
  const setupContext = setupFn!.length > 1 ? new SetupContext(instance) : null
  const node = setupFn!(
    // TODO __DEV__ ? shallowReadonly(props) :
    instance.props,
    // @ts-expect-error
    setupContext,
  )

  // single root, inherit attrs
  // let i
  // if (component.inheritAttrs !== false && node instanceof Element) {
  //   renderEffectSimple(() => {
  //     // for (const key in instance.attrs) {
  //     //   i = key
  //     // }
  //   })
  // }

  instance.scope.off()
  currentInstance = prevInstance
  resetTracking()
  // @ts-expect-error
  node.__vue__ = instance
  return node
}

let uid = 0
let currentInstance: ComponentInstance | null = null

export class ComponentInstance {
  type: Component
  uid: number = uid++
  scope: EffectScope = new EffectScope(true)
  props: Record<string, any>
  attrs: Record<string, any>
  constructor(comp: Component, rawProps?: RawProps) {
    this.type = comp
    // init props

    // TODO fast path for all static props

    let mayHaveFallthroughAttrs = false
    if (rawProps && comp.props) {
      if (rawProps.$) {
        // has dynamic props, use full proxy
        const handlers = getPropsProxyHandlers(comp)
        this.props = new Proxy(rawProps, handlers[0])
        this.attrs = new Proxy(rawProps, handlers[1])
        mayHaveFallthroughAttrs = true
      } else {
        // fast path for all static prop keys
        this.props = rawProps
        this.attrs = {}
        const propsOptions = normalizePropsOptions(comp)[0]!
        for (const key in propsOptions) {
          if (!(key in rawProps)) {
            rawProps[key] = undefined // TODO default value / casting
          } else {
            // TODO override getter with default value / casting
          }
        }
        for (const key in rawProps) {
          if (!(key in propsOptions)) {
            Object.defineProperty(
              this.attrs,
              key,
              Object.getOwnPropertyDescriptor(rawProps, key)!,
            )
            delete rawProps[key]
            mayHaveFallthroughAttrs = true
          }
        }
      }
    } else {
      this.props = EMPTY_OBJ
      this.attrs = rawProps || EMPTY_OBJ
      mayHaveFallthroughAttrs = !!rawProps
    }

    if (mayHaveFallthroughAttrs) {
      // TODO apply fallthrough attrs
    }
    // TODO init slots
  }
}

// TODO optimization: maybe convert functions into computeds
function resolveSource(source: DynamicPropsSource): Record<string, any> {
  return isFunction(source) ? source() : source
}

function getPropsProxyHandlers(
  comp: Component,
): [ProxyHandler<RawProps>, ProxyHandler<RawProps>] {
  if (comp.__propsHandlers) {
    return comp.__propsHandlers
  }
  let normalizedKeys: string[] | undefined
  const normalizedOptions = normalizePropsOptions(comp)[0]!
  const isProp = (key: string | symbol) => hasOwn(normalizedOptions, key)

  const getProp = (target: RawProps, key: string | symbol, asProp: boolean) => {
    if (key !== '$' && (asProp ? isProp(key) : !isProp(key))) {
      if (hasOwn(target, key)) {
        // TODO default value, casting, etc.
        return target[key]
      }
      if (target.$) {
        let source, resolved
        for (source of target.$) {
          resolved = resolveSource(source)
          if (hasOwn(resolved, key)) {
            return resolved[key]
          }
        }
      }
    }
  }

  const propsHandlers = {
    get: (target, key) => getProp(target, key, true),
    has: (_, key) => isProp(key),
    getOwnPropertyDescriptor(target, key) {
      if (isProp(key)) {
        return {
          configurable: true,
          enumerable: true,
          get: () => getProp(target, key, true),
        }
      }
    },
    ownKeys: () =>
      normalizedKeys || (normalizedKeys = Object.keys(normalizedOptions)),
    set: NO,
    deleteProperty: NO,
    // TODO dev traps to prevent mutation
  } satisfies ProxyHandler<RawProps>

  const hasAttr = (target: RawProps, key: string | symbol) => {
    if (key === '$' || isProp(key)) return false
    if (hasOwn(target, key)) return true
    if (target.$) {
      let source, resolved
      for (source of target.$) {
        resolved = resolveSource(source)
        if (hasOwn(resolved, key)) {
          return true
        }
      }
    }
    return false
  }

  const attrsHandlers = {
    get: (target, key) => getProp(target, key, false),
    has: hasAttr,
    getOwnPropertyDescriptor(target, key) {
      if (hasAttr(target, key)) {
        return {
          configurable: true,
          enumerable: true,
          get: () => getProp(target, key, false),
        }
      }
    },
    ownKeys(target) {
      const staticKeys = Object.keys(target).filter(
        key => key !== '$' && !isProp(key),
      )
      if (target.$) {
        for (const source of target.$) {
          staticKeys.push(...Object.keys(resolveSource(source)))
        }
      }
      return staticKeys
    },
    set: NO,
    deleteProperty: NO,
  } satisfies ProxyHandler<RawProps>

  return (comp.__propsHandlers = [propsHandlers, attrsHandlers])
}

export function renderEffectSimple(fn: () => void): void {
  const updateFn = () => {
    fn()
  }
  const effect = new ReactiveEffect(updateFn)
  const job: SchedulerJob = effect.runIfDirty.bind(effect)
  job.i = currentInstance as any
  job.id = currentInstance!.uid
  effect.scheduler = () => queueJob(job)
  effect.run()

  // TODO lifecycle
  // TODO recurse handling
  // TODO measure
}

// vapor app can be a subset of main app APIs
// TODO refactor core createApp for reuse
export function createVaporAppSimple(comp: Component): any {
  return {
    mount(container: string | ParentNode) {
      container = normalizeContainer(container)
      // clear content before mounting
      if (container.nodeType === 1 /* Node.ELEMENT_NODE */) {
        container.textContent = ''
      }
      const rootBlock = createComponentSimple(comp)
      insert(rootBlock, container)
    },
  }
}
