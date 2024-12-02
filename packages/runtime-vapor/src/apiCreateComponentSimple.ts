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
import { NO, camelize, hasOwn, isFunction } from '@vue/shared'
import { type SchedulerJob, queueJob } from '../../runtime-core/src/scheduler'
import { insert } from './dom/element'
import { normalizeContainer } from './apiRender'
import { normalizePropsOptions, resolvePropValue } from './componentProps'
import type { Block } from './block'

interface RawProps {
  [key: string]: PropSource
  $?: DynamicPropsSource[]
}

type PropSource<T = any> = T | (() => T)

type DynamicPropsSource = PropSource<Record<string, any>>

export function createComponentSimple(
  component: Component,
  rawProps?: RawProps,
): Block {
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
    instance.props,
    // @ts-expect-error
    setupContext,
  ) as Block

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
    let mayHaveFallthroughAttrs = false
    if (comp.props && rawProps && rawProps.$) {
      // has dynamic props, use proxy
      const handlers = getDynamicPropsHandlers(comp, this)
      this.props = new Proxy(rawProps, handlers[0])
      this.attrs = new Proxy(rawProps, handlers[1])
      mayHaveFallthroughAttrs = true
    } else {
      mayHaveFallthroughAttrs = initStaticProps(
        comp,
        rawProps,
        (this.props = {}),
        (this.attrs = {}),
      )
    }

    // TODO validate props

    if (mayHaveFallthroughAttrs) {
      // TODO apply fallthrough attrs
    }
    // TODO init slots
  }
}

function initStaticProps(
  comp: Component,
  rawProps: RawProps | undefined,
  props: any,
  attrs: any,
): boolean {
  let hasAttrs = false
  const [propsOptions, needCastKeys] = normalizePropsOptions(comp)
  for (const key in rawProps) {
    const normalizedKey = camelize(key)
    const needCast = needCastKeys && needCastKeys.includes(normalizedKey)
    const source = rawProps[key]
    if (propsOptions && normalizedKey in propsOptions) {
      if (isFunction(source)) {
        Object.defineProperty(props, normalizedKey, {
          enumerable: true,
          get: needCast
            ? () =>
                resolvePropValue(propsOptions, props, normalizedKey, source())
            : source,
        })
      } else {
        props[normalizedKey] = needCast
          ? resolvePropValue(propsOptions, props, normalizedKey, source)
          : source
      }
    } else {
      if (isFunction(source)) {
        Object.defineProperty(attrs, key, {
          enumerable: true,
          get: source,
        })
      } else {
        attrs[normalizedKey] = source
      }
      hasAttrs = true
    }
  }
  for (const key in propsOptions) {
    if (!(key in props)) {
      props[key] = resolvePropValue(propsOptions, props, key, undefined, true)
    }
  }
  return hasAttrs
}

// TODO optimization: maybe convert functions into computeds
function resolveSource(source: PropSource): Record<string, any> {
  return isFunction(source) ? source() : source
}

function getDynamicPropsHandlers(
  comp: Component,
  instance: ComponentInstance,
): [ProxyHandler<RawProps>, ProxyHandler<RawProps>] {
  if (comp.__propsHandlers) {
    return comp.__propsHandlers
  }
  let normalizedKeys: string[] | undefined
  const propsOptions = normalizePropsOptions(comp)[0]!
  const isProp = (key: string | symbol) => hasOwn(propsOptions, key)

  const getProp = (target: RawProps, key: string | symbol, asProp: boolean) => {
    if (key !== '$' && (asProp ? isProp(key) : !isProp(key))) {
      const castProp = (value: any, isAbsent?: boolean) =>
        asProp
          ? resolvePropValue(
              propsOptions,
              instance.props,
              key as string,
              value,
              isAbsent,
            )
          : value

      if (key in target) {
        // TODO default value, casting, etc.
        return castProp(resolveSource(target[key as string]))
      }
      if (target.$) {
        let source, resolved
        for (source of target.$) {
          resolved = resolveSource(source)
          if (hasOwn(resolved, key)) {
            return castProp(resolved[key])
          }
        }
      }
      return castProp(undefined, true)
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
      normalizedKeys || (normalizedKeys = Object.keys(propsOptions)),
    set: NO,
    deleteProperty: NO,
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
