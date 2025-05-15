import {
  type App,
  type Component,
  type ComponentCustomElementInterface,
  type ComponentInjectOptions,
  type ComponentInternalInstance,
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
  Fragment,
  type MethodOptions,
  type RenderFunction,
  type SetupContext,
  type SlotsType,
  type VNode,
  type VNodeArrayChildren,
  type VNodeProps,
  createVNode,
  defineComponent,
  getCurrentInstance,
  isVNode,
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

/*! #__NO_SIDE_EFFECTS__ */
export function defineCustomElement(
  options: any,
  extraOptions?: ComponentOptions,
  /**
   * @internal
   */
  _createApp?: CreateAppFunction<Element>,
): VueElementConstructor {
  const Comp = defineComponent(options, extraOptions) as any
  if (isPlainObject(Comp)) extend(Comp, extraOptions)
  class VueCustomElement extends VueElement {
    static def = Comp
    constructor(initialProps?: Record<string, any>) {
      super(Comp, initialProps, _createApp)
    }
  }

  return VueCustomElement
}

/*! #__NO_SIDE_EFFECTS__ */
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

export class VueElement
  extends BaseClass
  implements ComponentCustomElementInterface
{
  _isVueCE = true
  /**
   * @internal
   */
  _instance: ComponentInternalInstance | null = null
  /**
   * @internal
   */
  _app: App | null = null
  /**
   * @internal
   */
  _root: Element | ShadowRoot
  /**
   * @internal
   */
  _nonce: string | undefined = this._def.nonce

  /**
   * @internal
   */
  _teleportTarget?: HTMLElement

  private _connected = false
  private _resolved = false
  private _numberProps: Record<string, true> | null = null
  private _styleChildren = new WeakSet()
  private _pendingResolve: Promise<void> | undefined
  private _parent: VueElement | undefined
  /**
   * dev only
   */
  private _styles?: HTMLStyleElement[]
  /**
   * dev only
   */
  private _childStyles?: Map<string, HTMLStyleElement[]>
  private _ob?: MutationObserver | null = null
  private _slots?: Record<string, (Node & { $parentNode?: Node })[]>
  private _slotFallbacks?: Record<string, Node[]>
  private _slotAnchors?: Map<string, Node>

  constructor(
    /**
     * Component def - note this may be an AsyncWrapper, and this._def will
     * be overwritten by the inner component when resolved.
     */
    private _def: InnerComponentDef,
    private _props: Record<string, any> = {},
    private _createApp: CreateAppFunction<Element> = createApp,
  ) {
    super()
    if (this.shadowRoot && _createApp !== createApp) {
      this._root = this.shadowRoot
    } else {
      if (__DEV__ && this.shadowRoot) {
        warn(
          `Custom element has pre-rendered declarative shadow root but is not ` +
            `defined as hydratable. Use \`defineSSRCustomElement\`.`,
        )
      }
      if (_def.shadowRoot !== false) {
        this.attachShadow({ mode: 'open' })
        this._root = this.shadowRoot!
      } else {
        this._root = this
      }
    }

    if (!(this._def as ComponentOptions).__asyncLoader) {
      // for sync component defs we can immediately resolve props
      this._resolveProps(this._def)
    }
  }

  connectedCallback(): void {
    // avoid resolving component if it's not connected
    if (!this.isConnected) return

    if (!this.shadowRoot) {
      this._parseSlots()
    }
    this._connected = true

    // locate nearest Vue custom element parent for provide/inject
    let parent: Node | null = this
    while (
      (parent = parent && (parent.parentNode || (parent as ShadowRoot).host))
    ) {
      if (parent instanceof VueElement) {
        this._parent = parent
        break
      }
    }

    if (!this._instance) {
      if (this._resolved) {
        this._setParent()
        this._update()
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

  private _setParent(parent = this._parent) {
    if (parent) {
      this._instance!.parent = parent._instance
      this._instance!.provides = parent._instance!.provides
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
        // unmount
        this._app && this._app.unmount()
        if (this._instance) this._instance.ce = undefined
        this._app = this._instance = null
        this._slots = undefined
        this._slotFallbacks = undefined
        this._slotAnchors = undefined
      }
    })
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
    this._ob = new MutationObserver(mutations => {
      for (const m of mutations) {
        this._setAttr(m.attributeName!)
      }
    })

    this._ob.observe(this, { attributes: true })

    const resolve = (def: InnerComponentDef, isAsync = false) => {
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

      if (isAsync) {
        // defining getter/setters on prototype
        // for sync defs, this already happened in the constructor
        this._resolveProps(def)
      }

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
      this._mount(def)
    }

    const asyncDef = (this._def as ComponentOptions).__asyncLoader
    if (asyncDef) {
      this._pendingResolve = asyncDef().then(def =>
        resolve((this._def = def), true),
      )
    } else {
      resolve(this._def)
    }
  }

  private _mount(def: InnerComponentDef) {
    if ((__DEV__ || __FEATURE_PROD_DEVTOOLS__) && !def.name) {
      // @ts-expect-error
      def.name = 'VueElement'
    }
    this._app = this._createApp(def)
    if (def.configureApp) {
      def.configureApp(this._app)
    }
    this._app._ceVNode = this._createVNode()
    this._app.mount(this._root)

    // apply expose after mount
    const exposed = this._instance && this._instance.exposed
    if (!exposed) return
    for (const key in exposed) {
      if (!hasOwn(this, key)) {
        // exposed properties are readonly
        Object.defineProperty(this, key, {
          // unwrap ref to be consistent with public instance behavior
          get: () => unref(exposed[key]),
        })
      } else if (__DEV__) {
        warn(`Exposed property "${key}" already exists on custom element.`)
      }
    }
  }

  private _resolveProps(def: InnerComponentDef) {
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

  protected _setAttr(key: string): void {
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
        if (key === 'key' && this._app) {
          this._app._ceVNode!.key = val
        }
      }
      if (shouldUpdate && this._instance) {
        this._update()
      }
      // reflect
      if (shouldReflect) {
        const ob = this._ob
        ob && ob.disconnect()
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

  private _update() {
    render(this._createVNode(), this._root)
  }

  private _createVNode(): VNode<any, any> {
    const baseProps: VNodeProps = {}
    if (!this.shadowRoot) {
      baseProps.onVnodeMounted = () => {
        this._parseSlotFallbacks()
        this._renderSlots()
      }
      baseProps.onVnodeUpdated = this._renderSlots.bind(this)
    }
    const vnode = createVNode(this._def, extend(baseProps, this._props))
    if (!this._instance) {
      vnode.ce = instance => {
        this._instance = instance
        instance.ce = this
        instance.isCE = true // for vue-i18n backwards compat
        // HMR
        if (__DEV__) {
          instance.ceReload = newStyles => {
            // always reset styles
            if (this._styles) {
              this._styles.forEach(s => this._root.removeChild(s))
              this._styles.length = 0
            }
            this._applyStyles(newStyles)
            this._instance = null
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

        // intercept emit
        instance.emit = (event: string, ...args: any[]) => {
          // dispatch both the raw and hyphenated versions of an event
          // to match Vue behavior
          dispatch(event, args)
          if (hyphenate(event) !== event) {
            dispatch(hyphenate(event), args)
          }
        }

        this._setParent()
      }
    }
    return vnode
  }

  private _applyStyles(
    styles: string[] | undefined,
    owner?: ConcreteComponent,
  ) {
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
  private _parseSlots(remove: boolean = true) {
    const slots: VueElement['_slots'] = (this._slots = {})
    let n = this.firstChild
    while (n) {
      const slotName =
        (n.nodeType === 1 && (n as Element).getAttribute('slot')) || 'default'
      ;(slots[slotName] || (slots[slotName] = [])).push(n)
      const next = n.nextSibling
      // store the parentNode reference since node will be removed
      // but it is needed during patching
      ;(n as any).$parentNode = n.parentNode
      if (remove) this.removeChild(n)
      n = next
    }
  }

  /**
   * Only called when shadowRoot is false
   */
  private _renderSlots() {
    const outlets = (this._teleportTarget || this).querySelectorAll('slot')
    const scopeId = this._instance!.type.__scopeId

    for (let i = 0; i < outlets.length; i++) {
      const o = outlets[i] as HTMLSlotElement
      const slotName = o.getAttribute('name') || 'default'
      const content = this._slots![slotName]
      const parent = o.parentNode!

      // insert an anchor to facilitate updates
      const anchor = document.createTextNode('')
      ;(this._slotAnchors || (this._slotAnchors = new Map())).set(
        slotName,
        anchor,
      )
      parent.insertBefore(anchor, o)

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
          n.$parentNode = parent
          parent.insertBefore(n, anchor)
        }
      } else if (this._slotFallbacks) {
        const nodes = this._slotFallbacks[slotName]
        if (nodes) {
          for (const n of nodes) {
            parent.insertBefore(n, anchor)
          }
        }
      }
      parent.removeChild(o)
    }
  }

  /**
   * Only called when shadowRoot is false
   */
  _updateSlots(n1: VNode, n2: VNode): void {
    // switch v-if nodes
    const prevNodes = collectNodes(n1.children as VNodeArrayChildren)
    const newNodes = collectNodes(n2.children as VNodeArrayChildren)
    for (let i = 0; i < prevNodes.length; i++) {
      const prevNode = prevNodes[i]
      const newNode = newNodes[i]
      if (isComment(prevNode, 'v-if') || isComment(newNode, 'v-if')) {
        Object.entries(this._slots!).forEach(([_, nodes]) => {
          const nodeIndex = nodes.indexOf(prevNode)
          if (nodeIndex > -1) {
            nodes[nodeIndex] = newNode
          }
        })
      }
    }

    // switch between fallback and provided content
    if (this._slotFallbacks) {
      const oldSlotNames = Object.keys(this._slots!)
      // re-parse slots
      this._parseSlots(false)
      const newSlotNames = Object.keys(this._slots!)
      const allSlotNames = new Set([...oldSlotNames, ...newSlotNames])
      allSlotNames.forEach(name => {
        const fallbackNodes = this._slotFallbacks![name]
        if (fallbackNodes) {
          // render fallback nodes for removed slots
          if (!newSlotNames.includes(name)) {
            const anchor = this._slotAnchors!.get(name)!
            fallbackNodes.forEach(fallbackNode =>
              this.insertBefore(fallbackNode, anchor),
            )
          }

          // remove fallback nodes for added slots
          if (!oldSlotNames.includes(name)) {
            fallbackNodes.forEach(fallbackNode =>
              this.removeChild(fallbackNode),
            )
          }
        }
      })
    }
  }

  /**
   * Only called when shadowRoot is false
   */
  private _parseSlotFallbacks() {
    const outlets = (this._teleportTarget || this).querySelectorAll('slot')
    for (let i = 0; i < outlets.length; i++) {
      const slotElement = outlets[i] as HTMLSlotElement
      const slotName = slotElement.getAttribute('name') || 'default'
      const fallbackNodes: Node[] = []
      while (slotElement.firstChild) {
        fallbackNodes.push(slotElement.removeChild(slotElement.firstChild))
      }
      if (fallbackNodes.length) {
        ;(this._slotFallbacks || (this._slotFallbacks = {}))[slotName] =
          fallbackNodes
      }
    }
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

export function useHost(caller?: string): VueElement | null {
  const instance = getCurrentInstance()
  const el = instance && (instance.ce as VueElement)
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

function collectFragmentNodes(child: VNode): Node[] {
  return [
    child.el as Node,
    ...collectNodes(child.children as VNodeArrayChildren),
    child.anchor as Node,
  ]
}

function collectNodes(
  children: VNodeArrayChildren,
): (Node & { $parentNode?: Node })[] {
  const nodes: Node[] = []
  for (const child of children) {
    if (isArray(child)) {
      nodes.push(...collectNodes(child))
    } else if (isVNode(child)) {
      if (child.type === Fragment) {
        nodes.push(...collectFragmentNodes(child))
      } else if (child.el) {
        nodes.push(child.el as Node)
      }
    }
  }
  return nodes
}

function isComment(node: Node, data: string): node is Comment {
  return node.nodeType === 8 && (node as Comment).data === data
}
