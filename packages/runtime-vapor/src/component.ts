import {
  type ComponentInternalOptions,
  type ComponentPropsOptions,
  EffectScope,
  type EmitFn,
  type EmitsOptions,
  type GenericAppContext,
  type GenericComponentInstance,
  type LifecycleHook,
  type NormalizedPropsOptions,
  type ObjectEmitsOptions,
  nextUid,
  popWarningContext,
  pushWarningContext,
  warn,
} from '@vue/runtime-dom'
import { type Block, isBlock } from './block'
import { pauseTracking, resetTracking } from '@vue/reactivity'
import { EMPTY_OBJ, hasOwn, isFunction } from '@vue/shared'
import {
  type RawProps,
  getPropsProxyHandlers,
  normalizePropsOptions,
} from './componentProps'
import { setDynamicProp } from './dom/prop'
import { renderEffect } from './renderEffect'
import { emit, normalizeEmitsOptions } from './componentEmits'

export type VaporComponent = FunctionalVaporComponent | ObjectVaporComponent

export type VaporSetupFn = (
  props: any,
  ctx: SetupContext,
) => Block | Record<string, any> | undefined

export type FunctionalVaporComponent = VaporSetupFn &
  Omit<ObjectVaporComponent, 'setup'> & {
    displayName?: string
  } & SharedInternalOptions

export interface ObjectVaporComponent
  extends ComponentInternalOptions,
    SharedInternalOptions {
  setup?: VaporSetupFn
  inheritAttrs?: boolean
  props?: ComponentPropsOptions
  emits?: EmitsOptions
  render?(ctx: any): Block

  name?: string
  vapor?: boolean
}

interface SharedInternalOptions {
  /**
   * Cached normalized props options.
   * In vapor mode there are no mixins so normalized options can be cached
   * directly on the component
   */
  __propsOptions?: NormalizedPropsOptions
  /**
   * Cached normalized props proxy handlers.
   */
  __propsHandlers?: [ProxyHandler<any> | null, ProxyHandler<any>]
  /**
   * Cached normalized emits options.
   */
  __emitsOptions?: ObjectEmitsOptions
}

export function createComponent(
  component: VaporComponent,
  rawProps?: RawProps,
  isSingleRoot?: boolean,
): VaporComponentInstance {
  // check if we are the single root of the parent
  // if yes, inject parent attrs as dynamic props source
  if (isSingleRoot && currentInstance && currentInstance.hasFallthrough) {
    const attrs = currentInstance.attrs
    if (rawProps) {
      ;(rawProps.$ || (rawProps.$ = [])).push(() => attrs)
    } else {
      rawProps = { $: [() => attrs] } as RawProps
    }
  }

  const instance = new VaporComponentInstance(component, rawProps)

  pauseTracking()
  let prevInstance = currentInstance
  currentInstance = instance
  instance.scope.on()

  if (__DEV__) {
    pushWarningContext(instance)
  }

  const setupFn = isFunction(component) ? component : component.setup
  const setupContext = setupFn!.length > 1 ? new SetupContext(instance) : null
  const setupResult =
    setupFn!(
      instance.props,
      // @ts-expect-error
      setupContext,
    ) || EMPTY_OBJ

  if (__DEV__ && !isBlock(setupResult)) {
    if (isFunction(component)) {
      warn(`Functional vapor component must return a block directly.`)
      instance.block = []
    } else if (!component.render) {
      warn(
        `Vapor component setup() returned non-block value, and has no render function.`,
      )
      instance.block = []
    } else {
      instance.block = component.render.call(null, setupResult)
    }
  } else {
    // in prod result can only be block
    instance.block = setupResult as Block
  }

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

  if (__DEV__) {
    popWarningContext()
  }

  instance.scope.off()
  currentInstance = prevInstance
  resetTracking()
  return instance
}

export let currentInstance: VaporComponentInstance | null = null

const emptyContext: GenericAppContext = {
  app: null as any,
  config: {},
  provides: /*@__PURE__*/ Object.create(null),
}

export class VaporComponentInstance implements GenericComponentInstance {
  uid: number
  type: VaporComponent
  parent: GenericComponentInstance | null
  appContext: GenericAppContext

  block: Block
  scope: EffectScope
  rawProps: RawProps | undefined
  props: Record<string, any>
  attrs: Record<string, any>
  exposed: Record<string, any> | null

  emitted: Record<string, boolean> | null
  propsDefaults: Record<string, any> | null

  // for useTemplateRef()
  refs: Record<string, any>
  // for provide / inject
  provides: Record<string, any>

  hasFallthrough: boolean

  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean
  // LifecycleHooks.ERROR_CAPTURED
  ec: LifecycleHook

  // dev only
  setupState?: Record<string, any>
  propsOptions?: NormalizedPropsOptions
  emitsOptions?: ObjectEmitsOptions | null

  constructor(comp: VaporComponent, rawProps?: RawProps) {
    this.uid = nextUid()
    this.type = comp
    this.parent = currentInstance
    this.appContext = currentInstance
      ? currentInstance.appContext
      : emptyContext

    this.block = null! // to be set
    this.scope = new EffectScope(true)

    this.rawProps = rawProps
    this.provides = this.refs = EMPTY_OBJ
    this.emitted = this.ec = this.exposed = this.propsDefaults = null
    this.isMounted = this.isUnmounted = this.isDeactivated = false

    // init props
    const target = rawProps || EMPTY_OBJ
    const handlers = getPropsProxyHandlers(comp, this)
    this.props = comp.props ? new Proxy(target, handlers[0]!) : {}
    this.attrs = new Proxy(target, handlers[1])

    if (__DEV__) {
      // cache normalized options for dev only emit check
      this.propsOptions = normalizePropsOptions(comp)
      this.emitsOptions = normalizeEmitsOptions(comp)
    }

    // determine fallthrough
    this.hasFallthrough = false
    if (rawProps) {
      if (rawProps.$ || !comp.props) {
        this.hasFallthrough = true
      } else {
        // check if rawProps contains any keys not declared
        const propsOptions = normalizePropsOptions(comp)[0]
        for (const key in rawProps) {
          if (!hasOwn(propsOptions!, key)) {
            this.hasFallthrough = true
            break
          }
        }
      }
    }

    // TODO validate props
    // TODO init slots
  }
}

export function isVaporComponent(
  value: unknown,
): value is VaporComponentInstance {
  return value instanceof VaporComponentInstance
}

export class SetupContext<E = EmitsOptions> {
  attrs: Record<string, any>
  emit: EmitFn<E>
  // slots: Readonly<StaticSlots>
  expose: (exposed?: Record<string, any>) => void

  constructor(instance: VaporComponentInstance) {
    this.attrs = instance.attrs
    this.emit = emit.bind(null, instance) as EmitFn<E>
    // this.slots = instance.slots
    this.expose = (exposed = {}) => {
      instance.exposed = exposed
    }
  }
}
