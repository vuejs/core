import {
  type Component,
  type ComponentInjectOptions,
  type ComponentInternalInstance,
  type ComponentObjectPropsOptions,
  type ComponentOptions,
  type ComponentOptionsBase,
  type ComponentOptionsMixin,
  type ComponentProvideOptions,
  type ComputedOptions,
  type ConcreteComponent,
  type CreateComponentPublicInstanceWithMixins,
  type DefineComponent,
  type Directive,
  type EmitsOptions,
  type EmitsToProps,
  type ExtractPropTypes,
  type MethodOptions,
  type RenderFunction,
  type RootHydrateFunction,
  type SetupContext,
  type SlotsType,
  type VNode,
  type VNodeProps,
  createVNode,
  defineComponent,
  nextTick,
  warn,
} from '@vue/runtime-core'
import {
  camelize,
  extend,
  hyphenate,
  isArray,
  isPlainObject,
  toNumber,
} from '@vue/shared'
import { hydrate, render } from '.'

export type VueElementConstructor<P = {}> = {
  new (initialProps?: Record<string, any>): VueElement & P
}

export interface CustomElementOptions {
  styles?: string[]
  shadowRoot?: boolean
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
): VueElementConstructor<ResolvedProps>

// overload 5: defining a custom element from the returned value of
// `defineComponent`
export function defineCustomElement<P>(
  options: DefineComponent<P, any, any, any>,
): VueElementConstructor<ExtractPropTypes<P>>

/*! #__NO_SIDE_EFFECTS__ */
export function defineCustomElement(
  options: any,
  extraOptions?: ComponentOptions,
  /**
   * @internal
   */
  hydrate?: RootHydrateFunction,
): VueElementConstructor {
  const Comp = defineComponent(options, extraOptions) as any
  class VueCustomElement extends VueElement {
    static def = Comp
    constructor(initialProps?: Record<string, any>) {
      super(Comp, initialProps, hydrate)
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
  return defineCustomElement(options, extraOptions, hydrate)
}) as typeof defineCustomElement

const BaseClass = (
  typeof HTMLElement !== 'undefined' ? HTMLElement : class {}
) as typeof HTMLElement

type InnerComponentDef = ConcreteComponent & CustomElementOptions

export class VueElement extends BaseClass {
  /**
   * @internal
   */
  _instance: ComponentInternalInstance | null = null

  private _connected = false
  private _resolved = false
  private _numberProps: Record<string, true> | null = null
  private _styles?: HTMLStyleElement[]
  private _ob?: MutationObserver | null = null
  private _root: Element | ShadowRoot
  private _slots?: Record<string, Node[]>

  constructor(
    private _def: InnerComponentDef,
    private _props: Record<string, any> = {},
    hydrate?: RootHydrateFunction,
  ) {
    super()
    // TODO handle non-shadowRoot hydration
    if (this.shadowRoot && hydrate) {
      hydrate(this._createVNode(), this.shadowRoot)
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
      if (!(this._def as ComponentOptions).__asyncLoader) {
        // for sync component defs we can immediately resolve props
        this._resolveProps(this._def)
      }
    }
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this._parseSlots()
    }
    this._connected = true
    if (!this._instance) {
      if (this._resolved) {
        this._update()
      } else {
        this._resolveDef()
      }
    }
  }

  disconnectedCallback() {
    this._connected = false
    nextTick(() => {
      if (!this._connected) {
        if (this._ob) {
          this._ob.disconnect()
          this._ob = null
        }
        render(null, this._root)
        this._instance = null
      }
    })
  }

  /**
   * resolve inner component definition (handle possible async component)
   */
  private _resolveDef() {
    this._resolved = true

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
      this._applyStyles(styles)

      // initial render
      this._update()
    }

    const asyncDef = (this._def as ComponentOptions).__asyncLoader
    if (asyncDef) {
      asyncDef().then(def => resolve(def, true))
    } else {
      resolve(this._def)
    }
  }

  private _resolveProps(def: InnerComponentDef) {
    const { props } = def
    const declaredPropKeys = isArray(props) ? props : Object.keys(props || {})

    // check if there are props set pre-upgrade or connect
    for (const key of Object.keys(this)) {
      if (key[0] !== '_' && declaredPropKeys.includes(key)) {
        this._setProp(key, this[key as keyof this], true, false)
      }
    }

    // defining getter/setters on prototype
    for (const key of declaredPropKeys.map(camelize)) {
      Object.defineProperty(this, key, {
        get() {
          return this._getProp(key)
        },
        set(val) {
          this._setProp(key, val)
        },
      })
    }
  }

  protected _setAttr(key: string) {
    if (key.startsWith('data-v-')) return
    let value = this.hasAttribute(key) ? this.getAttribute(key) : undefined
    const camelKey = camelize(key)
    if (this._numberProps && this._numberProps[camelKey]) {
      value = toNumber(value)
    }
    this._setProp(camelKey, value, false)
  }

  /**
   * @internal
   */
  protected _getProp(key: string) {
    return this._props[key]
  }

  /**
   * @internal
   */
  protected _setProp(
    key: string,
    val: any,
    shouldReflect = true,
    shouldUpdate = true,
  ) {
    if (val !== this._props[key]) {
      this._props[key] = val
      if (shouldUpdate && this._instance) {
        this._update()
      }
      // reflect
      if (shouldReflect) {
        if (val === true) {
          this.setAttribute(hyphenate(key), '')
        } else if (typeof val === 'string' || typeof val === 'number') {
          this.setAttribute(hyphenate(key), val + '')
        } else if (!val) {
          this.removeAttribute(hyphenate(key))
        }
      }
    }
  }

  private _update() {
    render(this._createVNode(), this._root)
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
        instance.isCE = true
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

        // locate nearest Vue custom element parent for provide/inject
        let parent: Node | null = this
        while (
          (parent =
            parent && (parent.parentNode || (parent as ShadowRoot).host))
        ) {
          if (parent instanceof VueElement) {
            instance.parent = parent._instance
            instance.provides = parent._instance!.provides
            break
          }
        }
      }
    }
    return vnode
  }

  private _applyStyles(styles: string[] | undefined) {
    if (styles) {
      styles.forEach(css => {
        const s = document.createElement('style')
        s.textContent = css
        this._root.appendChild(s)
        // record for HMR
        if (__DEV__) {
          ;(this._styles || (this._styles = [])).push(s)
        }
      })
    }
  }

  /**
   * Only called when shaddowRoot is false
   */
  private _parseSlots() {
    const slots: VueElement['_slots'] = (this._slots = {})
    let n
    while ((n = this.firstChild)) {
      const slotName =
        (n.nodeType === 1 && (n as Element).getAttribute('slot')) || 'default'
      ;(slots[slotName] || (slots[slotName] = [])).push(n)
      this.removeChild(n)
    }
  }

  /**
   * Only called when shaddowRoot is false
   */
  private _renderSlots() {
    const outlets = this.querySelectorAll('slot')
    const scopeId = this._instance!.type.__scopeId
    for (let i = 0; i < outlets.length; i++) {
      const o = outlets[i] as HTMLSlotElement
      const slotName = o.getAttribute('name') || 'default'
      const content = this._slots![slotName]
      const parent = o.parentNode!
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
        }
      } else {
        while (o.firstChild) parent.insertBefore(o.firstChild, o)
      }
      parent.removeChild(o)
    }
  }
}
