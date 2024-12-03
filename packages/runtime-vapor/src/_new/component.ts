import {
  type ComponentPropsOptions,
  EffectScope,
  type EmitsOptions,
  type NormalizedPropsOptions,
  type ObjectEmitsOptions,
} from '@vue/runtime-core'
import type { Block } from '../block'
import type { Data } from '@vue/runtime-shared'
import { pauseTracking, resetTracking } from '@vue/reactivity'
import { isFunction } from '@vue/shared'
import {
  type RawProps,
  getDynamicPropsHandlers,
  initStaticProps,
} from './componentProps'
import { setDynamicProp } from '../dom/prop'
import { renderEffect } from './renderEffect'

export type Component = FunctionalComponent | ObjectComponent

export type SetupFn = (
  props: any,
  ctx: SetupContext,
) => Block | Data | undefined

export type FunctionalComponent = SetupFn &
  Omit<ObjectComponent, 'setup'> & {
    displayName?: string
  } & SharedInternalOptions

export interface ObjectComponent
  extends ComponentInternalOptions,
    SharedInternalOptions {
  setup?: SetupFn
  inheritAttrs?: boolean
  props?: ComponentPropsOptions
  emits?: EmitsOptions
  render?(ctx: any): Block

  name?: string
  vapor?: boolean
}

interface SharedInternalOptions {
  __propsOptions?: NormalizedPropsOptions
  __propsHandlers?: [ProxyHandler<any>, ProxyHandler<any>]
  __emitsOptions?: ObjectEmitsOptions
}

// Note: can't mark this whole interface internal because some public interfaces
// extend it.
interface ComponentInternalOptions {
  /**
   * @internal
   */
  __scopeId?: string
  /**
   * @internal
   */
  __cssModules?: Data
  /**
   * @internal
   */
  __hmrId?: string
  /**
   * This one should be exposed so that devtools can make use of it
   */
  __file?: string
  /**
   * name inferred from filename
   */
  __name?: string
}

export function createComponent(
  component: Component,
  rawProps?: RawProps,
  isSingleRoot?: boolean,
): ComponentInstance {
  // check if we are the single root of the parent
  // if yes, inject parent attrs as dynamic props source
  if (isSingleRoot && currentInstance && currentInstance.hasFallthrough) {
    if (rawProps) {
      ;(rawProps.$ || (rawProps.$ = [])).push(currentInstance.attrs)
    } else {
      rawProps = { $: [currentInstance.attrs] }
    }
  }

  const instance = new ComponentInstance(component, rawProps)

  pauseTracking()
  let prevInstance = currentInstance
  currentInstance = instance
  instance.scope.on()

  const setupFn = isFunction(component) ? component : component.setup
  const setupContext = setupFn!.length > 1 ? new SetupContext(instance) : null
  instance.block = setupFn!(
    instance.props,
    // @ts-expect-error
    setupContext,
  ) as Block // TODO handle return object

  // single root, inherit attrs
  if (
    instance.hasFallthrough &&
    component.inheritAttrs !== false &&
    instance.block instanceof Element &&
    Object.keys(instance.attrs).length
  ) {
    renderEffect(() => {
      for (const key in instance.attrs) {
        setDynamicProp(instance.block as Element, key, instance.attrs[key])
      }
    })
  }

  instance.scope.off()
  currentInstance = prevInstance
  resetTracking()
  return instance
}

let uid = 0
export let currentInstance: ComponentInstance | null = null

export class ComponentInstance {
  type: Component
  uid: number = uid++
  scope: EffectScope = new EffectScope(true)
  props: Record<string, any>
  propsDefaults: Record<string, any> | null
  attrs: Record<string, any>
  block: Block
  exposed?: Record<string, any>
  hasFallthrough: boolean

  constructor(comp: Component, rawProps?: RawProps) {
    this.type = comp
    this.block = null! // to be set

    // init props
    this.propsDefaults = null
    this.hasFallthrough = false
    if (comp.props && rawProps && rawProps.$) {
      // has dynamic props, use proxy
      const handlers = getDynamicPropsHandlers(comp, this)
      this.props = new Proxy(rawProps, handlers[0])
      this.attrs = new Proxy(rawProps, handlers[1])
      this.hasFallthrough = true
    } else {
      this.props = {}
      this.attrs = {}
      this.hasFallthrough = initStaticProps(comp, rawProps, this)
    }

    // TODO validate props
    // TODO init slots
  }
}

export function isVaporComponent(value: unknown): value is ComponentInstance {
  return value instanceof ComponentInstance
}

export class SetupContext<E = EmitsOptions> {
  attrs: Record<string, any>
  // emit: EmitFn<E>
  // slots: Readonly<StaticSlots>
  expose: (exposed?: Record<string, any>) => void

  constructor(instance: ComponentInstance) {
    this.attrs = instance.attrs
    // this.emit = instance.emit as EmitFn<E>
    // this.slots = instance.slots
    this.expose = (exposed = {}) => {
      instance.exposed = exposed
    }
  }
}
