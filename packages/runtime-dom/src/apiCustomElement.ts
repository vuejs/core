import {
  type App,
  type Component,
  type ComponentCustomElementInterface,
  type ComponentInjectOptions,
  type ComponentObjectPropsOptions,
  type ComponentOptions,
  type ComponentOptionsBase,
  type ComponentOptionsMixin,
  type ComponentProvideOptions,
  type ComponentPublicInstance,
  type ComputedOptions,
  type ConcreteComponent,
  type CreateAppFunction,
  type CreateComponentPublicInstanceWithMixins,
  type DefineComponent,
  type Directive,
  type EmitsOptions,
  type EmitsToProps,
  type ExtractPropTypes,
  type GenericComponentInstance,
  type MethodOptions,
  type RenderFunction,
  type SetupContext,
  type SlotsType,
  type VNode,
  type VNodeProps,
  createVNode,
  defineComponent,
  getCurrentInstance,
  nextTick,
  unref,
  warn,
} from '@vue/runtime-core'
import {
  camelize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isPlainObject,
  toNumber,
} from '@vue/shared'
import { createApp, createSSRApp, render } from '.'

// marker for attr removal
const REMOVAL = {}

export type VueElementConstructor<P = {}> = {
  new (initialProps?: Record<string, any>): VueElement & P
}

export interface CustomElementOptions {
  styles?: string[]
  shadowRoot?: boolean
  shadowRootOptions?: Omit<ShadowRootInit, 'mode'>
  nonce?: string
  configureApp?: (app: App) => void
}

// defineCustomElement provides the same type inference as defineComponent
// so most of the following overloads should be kept in sync w/ defineComponent.

// overload 1: direct setup function
export function defineCustomElement<Props, RawBindings = object>(
  setup: (props: Props, ctx: SetupContext) => RawBindings | RenderFunction,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs' | 'emits'> &
    CustomElementOptions & {
      props?: (keyof Props)[]
    },
): VueElementConstructor<Props>
export function defineCustomElement<Props, RawBindings = object>(
  setup: (props: Props, ctx: SetupContext) => RawBindings | RenderFunction,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs' | 'emits'> &
    CustomElementOptions & {
      props?: ComponentObjectPropsOptions<Props>
    },
): VueElementConstructor<Props>

// overload 2: defineCustomElement with options object, infer props from options
export function defineCustomElement<
  // props
  RuntimePropsOptions extends
    ComponentObjectPropsOptions = ComponentObjectPropsOptions,
  PropsKeys extends string = string,
  // emits
  RuntimeEmitsOptions extends EmitsOptions = {},
  EmitsKeys extends string = string,
  // other options
  Data = {},
  SetupBindings = {},
  Computed extends ComputedOptions = {},
  Methods extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  InjectOptions extends ComponentInjectOptions = {},
  InjectKeys extends string = string,
  Slots extends SlotsType = {},
  LocalComponents extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  // resolved types
  InferredProps = string extends PropsKeys
    ? ComponentObjectPropsOptions extends RuntimePropsOptions
      ? {}
      : ExtractPropTypes<RuntimePropsOptions>
    : { [key in PropsKeys]?: any },
  ResolvedProps = InferredProps & EmitsToProps<RuntimeEmitsOptions>,
>(
  options: CustomElementOptions & {
    props?: (RuntimePropsOptions & ThisType<void>) | PropsKeys[]
  } & ComponentOptionsBase<
      ResolvedProps,
      SetupBindings,
      Data,
      Computed,
      Methods,
      Mixin,
      Extends,
      RuntimeEmitsOptions,
      EmitsKeys,
      {}, // Defaults
      InjectOptions,
      InjectKeys,
      Slots,
      LocalComponents,
      Directives,
      Exposed,
      Provide
    > &
    ThisType<
      CreateComponentPublicInstanceWithMixins<
        Readonly<ResolvedProps>,
        SetupBindings,
        Data,
        Computed,
        Methods,
        Mixin,
        Extends,
        RuntimeEmitsOptions,
        EmitsKeys,
        {},
        false,
        InjectOptions,
        Slots,
        LocalComponents,
        Directives,
        Exposed
      >
    >,
  extraOptions?: CustomElementOptions,
): VueElementConstructor<ResolvedProps>

// overload 3: defining a custom element from the returned value of
// `defineComponent`
export function defineCustomElement<
  // this should be `ComponentPublicInstanceConstructor` but that type is not exported
  T extends { new (...args: any[]): ComponentPublicInstance<any> },
>(
  options: T,
  extraOptions?: CustomElementOptions,
): VueElementConstructor<
  T extends DefineComponent<infer P, any, any, any> ? P : unknown
>

/*@__NO_SIDE_EFFECTS__*/
export function defineCustomElement(
  options: any,
  extraOptions?: ComponentOptions,
  /**
   * @internal
   */
  _createApp?: CreateAppFunction<Element>,
): VueElementConstructor {
  let Comp = defineComponent(options, extraOptions) as any
  if (isPlainObject(Comp)) Comp = extend({}, Comp, extraOptions)
  class VueCustomElement extends VueElement {
    static def = Comp
    constructor(initialProps?: Record<string, any>) {
      super(Comp, initialProps, _createApp)
    }
  }

  return VueCustomElement
}

/*@__NO_SIDE_EFFECTS__*/
export const defineSSRCustomElement = ((
  options: any,
  extraOptions?: ComponentOptions,
) => {
  // @ts-expect-error
  return defineCustomElement(options, extraOptions, createSSRApp)
}) as typeof defineCustomElement

const BaseClass = (
  typeof HTMLElement !== 'undefined' ? HTMLElement : class {}
) as typeof HTMLElement

type InnerComponentDef = ConcreteComponent & CustomElementOptions

export abstract class VueElementBase<
    E = Element,
    C = Component,
    Def extends CustomElementOptions & { props?: any } = InnerComponentDef,
  >
  extends BaseClass
  implements ComponentCustomElementInterface
{
  _isVueCE = true
  /**
   * @internal
   */
  _instance: GenericComponentInstance | null = null
  /**
   * @internal
   */
  _app: App | null = null
  /**
   * @internal
   */
  _root!: Element | ShadowRoot
  /**
   * @internal
   */
  _nonce: string | undefined
  /**
   * @internal
   */
  _teleportTargets?: Set<Element>

  protected _def: Def
  protected _props: Record<string, any>
  protected _createApp: CreateAppFunction<E, C>
  protected _connected = false
  protected _resolved = false
  protected _numberProps: Record<string, true> | null = null
  protected _styleChildren: WeakSet<object> = new WeakSet()
  protected _pendingResolve: Promise<void> | undefined
  protected _parent: VueElementBase | undefined

  /**
   * dev only
   */
  protected _styles?: HTMLStyleElement[]
  /**
   * dev only
   */
  protected _childStyles?: Map<string, HTMLStyleElement[]>
  protected _ob?: MutationObserver | null = null
  protected _slots?: Record<string, Node[]>

  protected abstract _hasPreRendered(): boolean | undefined
  protected abstract _mount(def: Def): void
  protected abstract _update(): void
  protected abstract _unmount(): void
  protected abstract _updateSlotNodes(slot: Map<Node, Node[]>): void

  constructor(
    /**
     * Component def - note this may be an AsyncWrapper, and this._def will
     * be overwritten by the inner component when resolved.
     */
    def: Def,
    props: Record<string, any> | undefined = {},
    createAppFn: CreateAppFunction<E, C>,
  ) {
    super()
    this._def = def
    this._props = props
    this._createApp = createAppFn
    this._nonce = def.nonce

    if (this._hasPreRendered()) {
      if (def.shadowRoot !== false) {
        this.attachShadow(
          extend({}, def.shadowRootOptions, {
            mode: 'open',
          }) as ShadowRootInit,
        )
        this._root = this.shadowRoot!
      } else {
        this._root = this
      }
    }
  }

  connectedCallback(): void {
    // avoid resolving component if it's not connected
    if (!this.isConnected) return

    // avoid re-parsing slots if already resolved
    if (!this.shadowRoot && !this._resolved) {
      this._parseSlots()
    }
    this._connected = true

    // locate nearest Vue custom element parent for provide/inject
    let parent: Node | null = this
    while (
      (parent = parent && (parent.parentNode || (parent as ShadowRoot).host))
    ) {
      if (parent instanceof VueElementBase) {
        this._parent = parent
        break
      }
    }

    if (!this._instance) {
      if (this._resolved) {
        this._mountComponent(this._def)
      } else {
        if (parent && parent._pendingResolve) {
          this._pendingResolve = parent._pendingResolve.then(() => {
            this._pendingResolve = undefined
            this._resolveDef()
          })
        } else {
          this._resolveDef()
        }
      }
    }
  }

  disconnectedCallback(): void {
    this._connected = false
    nextTick(() => {
      if (!this._connected) {
        if (this._ob) {
          this._ob.disconnect()
          this._ob = null
        }
        this._unmount()
        if (this._teleportTargets) {
          this._teleportTargets.clear()
          this._teleportTargets = undefined
        }
      }
    })
  }

  protected _setParent(
    parent: VueElementBase | undefined = this._parent,
  ): void {
    if (parent && this._instance) {
      this._instance.parent = parent._instance
      this._inheritParentContext(parent)
    }
  }

  protected _inheritParentContext(
    parent: VueElementBase | undefined = this._parent,
  ): void {
    // #13212, the provides object of the app context must inherit the provides
    // object from the parent element so we can inject values from both places
    if (parent && this._app) {
      Object.setPrototypeOf(
        this._app._context.provides,
        parent._instance!.provides,
      )
    }
  }

  private _processMutations(mutations: MutationRecord[]) {
    for (const m of mutations) {
      this._setAttr(m.attributeName!)
    }
  }

  /**
   * resolve inner component definition (handle possible async component)
   */
  private _resolveDef() {
    if (this._pendingResolve) {
      return
    }

    // set initial attrs
    for (let i = 0; i < this.attributes.length; i++) {
      this._setAttr(this.attributes[i].name)
    }

    // watch future attr changes
    this._ob = new MutationObserver(this._processMutations.bind(this))

    this._ob.observe(this, { attributes: true })

    const resolve = (def: Def) => {
      this._resolved = true
      this._pendingResolve = undefined

      const { props, styles } = def

      // cast Number-type props set before resolve
      let numberProps
      if (props && !isArray(props)) {
        for (const key in props) {
          const opt = props[key]
          if (opt === Number || (opt && opt.type === Number)) {
            if (key in this._props) {
              this._props[key] = toNumber(this._props[key])
            }
            ;(numberProps || (numberProps = Object.create(null)))[
              camelize(key)
            ] = true
          }
        }
      }
      this._numberProps = numberProps
      this._resolveProps(def)

      // apply CSS
      if (this.shadowRoot) {
        this._applyStyles(styles)
      } else if (__DEV__ && styles) {
        warn(
          'Custom element style injection is not supported when using ' +
            'shadowRoot: false',
        )
      }

      // initial mount
      this._mountComponent(def)
    }

    const asyncDef = (this._def as ComponentOptions).__asyncLoader
    if (asyncDef) {
      const { configureApp } = this._def
      this._pendingResolve = asyncDef().then((def: any) => {
        def.configureApp = configureApp
        this._def = def
        resolve(def)
      })
    } else {
      resolve(this._def)
    }
  }

  private _mountComponent(def: Def): void {
    this._mount(def)
    this._processExposed()
  }

  protected _processExposed(): void {
    const exposed = this._instance && this._instance.exposed
    if (!exposed) return
    for (const key in exposed) {
      if (!hasOwn(this, key)) {
        Object.defineProperty(this, key, {
          get: () => unref(exposed[key]),
        })
      } else if (__DEV__) {
        warn(`Exposed property "${key}" already exists on custom element.`)
      }
    }
  }

  protected _processInstance(): void {
    this._instance!.ce = this
    this._instance!.isCE = true

    if (__DEV__) {
      this._instance!.ceReload = newStyles => {
        if (this._styles) {
          this._styles.forEach(s => this._root.removeChild(s))
          this._styles.length = 0
        }
        this._applyStyles(newStyles)
        if (!this._instance!.vapor) {
          this._instance = null
        }
        this._update()
      }
    }

    const dispatch = (event: string, args: any[]) => {
      this.dispatchEvent(
        new CustomEvent(
          event,
          isPlainObject(args[0])
            ? extend({ detail: args }, args[0])
            : { detail: args },
        ),
      )
    }

    this._instance!.emit = (event: string, ...args: any[]) => {
      dispatch(event, args)
      if (hyphenate(event) !== event) {
        dispatch(hyphenate(event), args)
      }
    }

    this._setParent()
  }

  private _resolveProps(def: Def): void {
    const { props } = def
    const declaredPropKeys = isArray(props) ? props : Object.keys(props || {})

    // check if there are props set pre-upgrade or connect
    for (const key of Object.keys(this)) {
      if (key[0] !== '_' && declaredPropKeys.includes(key)) {
        this._setProp(key, this[key as keyof this])
      }
    }

    // defining getter/setters on prototype
    for (const key of declaredPropKeys.map(camelize)) {
      Object.defineProperty(this, key, {
        get() {
          return this._getProp(key)
        },
        set(val) {
          this._setProp(key, val, true, true)
        },
      })
    }
  }

  private _setAttr(key: string): void {
    if (key.startsWith('data-v-')) return
    const has = this.hasAttribute(key)
    let value = has ? this.getAttribute(key) : REMOVAL
    const camelKey = camelize(key)
    if (has && this._numberProps && this._numberProps[camelKey]) {
      value = toNumber(value)
    }
    this._setProp(camelKey, value, false, true)
  }

  /**
   * @internal
   */
  protected _getProp(key: string): any {
    return this._props[key]
  }

  /**
   * @internal
   */
  _setProp(
    key: string,
    val: any,
    shouldReflect = true,
    shouldUpdate = false,
  ): void {
    if (val !== this._props[key]) {
      if (val === REMOVAL) {
        delete this._props[key]
      } else {
        this._props[key] = val
        // support set key on ceVNode
        if (key === 'key' && this._app && this._app._ceVNode) {
          this._app._ceVNode!.key = val
        }
      }
      if (shouldUpdate && this._instance) {
        this._update()
      }
      // reflect
      if (shouldReflect) {
        const ob = this._ob
        if (ob) {
          this._processMutations(ob.takeRecords())
          ob.disconnect()
        }
        if (val === true) {
          this.setAttribute(hyphenate(key), '')
        } else if (typeof val === 'string' || typeof val === 'number') {
          this.setAttribute(hyphenate(key), val + '')
        } else if (!val) {
          this.removeAttribute(hyphenate(key))
        }
        ob && ob.observe(this, { attributes: true })
      }
    }
  }

  protected _applyStyles(
    styles: string[] | undefined,
    owner?: ConcreteComponent,
  ): void {
    if (!styles) return
    if (owner) {
      if (owner === this._def || this._styleChildren.has(owner)) {
        return
      }
      this._styleChildren.add(owner)
    }
    const nonce = this._nonce
    for (let i = styles.length - 1; i >= 0; i--) {
      const s = document.createElement('style')
      if (nonce) s.setAttribute('nonce', nonce)
      s.textContent = styles[i]
      this.shadowRoot!.prepend(s)
      // record for HMR
      if (__DEV__) {
        if (owner) {
          if (owner.__hmrId) {
            if (!this._childStyles) this._childStyles = new Map()
            let entry = this._childStyles.get(owner.__hmrId)
            if (!entry) {
              this._childStyles.set(owner.__hmrId, (entry = []))
            }
            entry.push(s)
          }
        } else {
          ;(this._styles || (this._styles = [])).push(s)
        }
      }
    }
  }

  /**
   * Only called when shadowRoot is false
   */
  private _parseSlots() {
    const slots: VueElementBase['_slots'] = (this._slots = {})
    let n
    while ((n = this.firstChild)) {
      const slotName =
        (n.nodeType === 1 && (n as Element).getAttribute('slot')) || 'default'
      ;(slots[slotName] || (slots[slotName] = [])).push(n)
      this.removeChild(n)
    }
  }

  /**
   * Only called when shadowRoot is false
   */
  protected _renderSlots(): void {
    const outlets = this._getSlots()
    const scopeId = this._instance!.type.__scopeId
    const slotReplacements: Map<Node, Node[]> = new Map()

    for (let i = 0; i < outlets.length; i++) {
      const o = outlets[i] as HTMLSlotElement
      const slotName = o.getAttribute('name') || 'default'
      const content = this._slots![slotName]
      const parent = o.parentNode!
      const replacementNodes: Node[] = []

      if (content) {
        for (const n of content) {
          // for :slotted css
          if (scopeId && n.nodeType === 1) {
            const id = scopeId + '-s'
            const walker = document.createTreeWalker(n, 1)
            ;(n as Element).setAttribute(id, '')
            let child
            while ((child = walker.nextNode())) {
              ;(child as Element).setAttribute(id, '')
            }
          }
          parent.insertBefore(n, o)
          replacementNodes.push(n)
        }
      } else {
        while (o.firstChild) {
          const child = o.firstChild
          parent.insertBefore(child, o)
          replacementNodes.push(child)
        }
      }
      parent.removeChild(o)
      slotReplacements.set(o, replacementNodes)
    }

    this._updateSlotNodes(slotReplacements)
  }

  /**
   * @internal
   */
  private _getSlots(): HTMLSlotElement[] {
    const roots: Element[] = [this]
    if (this._teleportTargets) {
      roots.push(...this._teleportTargets)
    }
    return roots.reduce<HTMLSlotElement[]>((res, i) => {
      res.push(...Array.from(i.querySelectorAll('slot')))
      return res
    }, [])
  }

  /**
   * @internal
   */
  _injectChildStyle(comp: ConcreteComponent & CustomElementOptions): void {
    this._applyStyles(comp.styles, comp)
  }

  /**
   * @internal
   */
  _removeChildStyle(comp: ConcreteComponent): void {
    if (__DEV__) {
      this._styleChildren.delete(comp)
      if (this._childStyles && comp.__hmrId) {
        // clear old styles
        const oldStyles = this._childStyles.get(comp.__hmrId)
        if (oldStyles) {
          oldStyles.forEach(s => this._root.removeChild(s))
          oldStyles.length = 0
        }
      }
    }
  }
}

export class VueElement extends VueElementBase<
  Element,
  Component,
  InnerComponentDef
> {
  constructor(
    def: InnerComponentDef,
    props: Record<string, any> | undefined = {},
    createAppFn: CreateAppFunction<Element, Component> = createApp,
  ) {
    super(def, props, createAppFn)
  }

  protected _hasPreRendered(): boolean | undefined {
    if (this.shadowRoot && this._createApp !== createApp) {
      this._root = this.shadowRoot
    } else {
      if (__DEV__ && this.shadowRoot) {
        warn(
          `Custom element has pre-rendered declarative shadow root but is not ` +
            `defined as hydratable. Use \`defineSSRCustomElement\`.`,
        )
      }
      return true
    }
  }

  protected _mount(def: InnerComponentDef): void {
    if ((__DEV__ || __FEATURE_PROD_DEVTOOLS__) && !def.name) {
      // @ts-expect-error
      def.name = 'VueElement'
    }
    this._app = this._createApp(def)
    this._inheritParentContext()
    if (def.configureApp) {
      def.configureApp(this._app)
    }
    this._app._ceVNode = this._createVNode()
    this._app.mount(this._root)
  }

  protected _update(): void {
    if (!this._app) return
    const vnode = this._createVNode()
    vnode.appContext = this._app._context
    render(vnode, this._root)
  }

  protected _unmount(): void {
    if (this._app) {
      this._app.unmount()
    }
    if (this._instance && this._instance.ce) {
      this._instance.ce = undefined
    }
    this._app = this._instance = null
  }

  /**
   * Only called when shadowRoot is false
   */
  protected _updateSlotNodes(replacements: Map<Node, Node[]>): void {
    // do nothing
  }

  private _createVNode(): VNode<any, any> {
    const baseProps: VNodeProps = {}
    if (!this.shadowRoot) {
      baseProps.onVnodeMounted = baseProps.onVnodeUpdated =
        this._renderSlots.bind(this)
    }
    const vnode = createVNode(this._def, extend(baseProps, this._props))
    if (!this._instance) {
      vnode.ce = instance => {
        this._instance = instance
        this._processInstance()
      }
    }
    return vnode
  }
}

export function useHost(caller?: string): VueElementBase | null {
  const instance = getCurrentInstance()
  const el = instance && (instance.ce as VueElementBase)
  if (el) {
    return el
  } else if (__DEV__) {
    if (!instance) {
      warn(
        `${caller || 'useHost'} called without an active component instance.`,
      )
    } else {
      warn(
        `${caller || 'useHost'} can only be used in components defined via ` +
          `defineCustomElement.`,
      )
    }
  }
  return null
}

/**
 * Retrieve the shadowRoot of the current custom element. Only usable in setup()
 * of a `defineCustomElement` component.
 */
export function useShadowRoot(): ShadowRoot | null {
  const el = __DEV__ ? useHost('useShadowRoot') : useHost()
  return el && el.shadowRoot
}
