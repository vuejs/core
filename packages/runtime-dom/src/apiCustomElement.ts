import {
  type ComponentInjectOptions,
  type ComponentInternalInstance,
  type ComponentObjectPropsOptions,
  type ComponentOptions,
  type ComponentOptionsMixin,
  type ComponentOptionsWithArrayProps,
  type ComponentOptionsWithObjectProps,
  type ComponentOptionsWithoutProps,
  type ComponentPropsOptions,
  type ComputedOptions,
  type ConcreteComponent,
  type DefineComponent,
  type EmitsOptions,
  type ExtractPropTypes,
  type MethodOptions,
  type RenderFunction,
  type RootHydrateFunction,
  type SetupContext,
  type SlotsType,
  type VNode,
  createVNode,
  defineComponent,
  nextTick,
  warn,
} from '@vue/runtime-core'
import { camelize, extend, hyphenate, isArray, toNumber } from '@vue/shared'
import { hydrate, render } from '.'

export type VueElementConstructor<P = {}> = {
  new (initialProps?: Record<string, any>): VueElement & P
}

// defineCustomElement provides the same type inference as defineComponent
// so most of the following overloads should be kept in sync w/ defineComponent.

// overload 1: direct setup function
export function defineCustomElement<Props, RawBindings = object>(
  setup: (props: Props, ctx: SetupContext) => RawBindings | RenderFunction,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs' | 'emits'> & {
    props?: (keyof Props)[]
  },
): VueElementConstructor<Props>
export function defineCustomElement<Props, RawBindings = object>(
  setup: (props: Props, ctx: SetupContext) => RawBindings | RenderFunction,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs' | 'emits'> & {
    props?: ComponentObjectPropsOptions<Props>
  },
): VueElementConstructor<Props>

// overload 2: object format with no props
export function defineCustomElement<
  Props = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
>(
  options: ComponentOptionsWithoutProps<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    I,
    II,
    S
  > & { styles?: string[] },
): VueElementConstructor<Props>

// overload 3: object format with array props declaration
export function defineCustomElement<
  PropNames extends string,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = Record<string, any>,
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
>(
  options: ComponentOptionsWithArrayProps<
    PropNames,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    I,
    II,
    S
  > & { styles?: string[] },
): VueElementConstructor<{ [K in PropNames]: any }>

// overload 4: object format with object props declaration
export function defineCustomElement<
  PropsOptions extends Readonly<ComponentPropsOptions>,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = Record<string, any>,
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
>(
  options: ComponentOptionsWithObjectProps<
    PropsOptions,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    I,
    II,
    S
  > & { styles?: string[] },
): VueElementConstructor<ExtractPropTypes<PropsOptions>>

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

type InnerComponentDef = ConcreteComponent & { styles?: string[] }

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
  private _childStylesAnchor?: HTMLStyleElement
  private _childStylesSet: Set<string> = new Set<string>()
  constructor(
    private _def: InnerComponentDef,
    private _props: Record<string, any> = {},
    hydrate?: RootHydrateFunction,
  ) {
    super()
    if (this.shadowRoot && hydrate) {
      hydrate(this._createVNode(), this.shadowRoot)
    } else {
      if (__DEV__ && this.shadowRoot) {
        warn(
          `Custom element has pre-rendered declarative shadow root but is not ` +
            `defined as hydratable. Use \`defineSSRCustomElement\`.`,
        )
      }
      this.attachShadow({ mode: 'open' })
      if (!(this._def as ComponentOptions).__asyncLoader) {
        // for sync component defs we can immediately resolve props
        this._resolveProps(this._def)
      }
    }
  }

  connectedCallback() {
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
        render(null, this.shadowRoot!)
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
    render(this._createVNode(), this.shadowRoot!)
  }

  private _createVNode(): VNode<any, any> {
    const vnode = createVNode(this._def, extend({}, this._props))
    if (!this._instance) {
      vnode.ce = instance => {
        this._instance = instance
        instance.isCE = true

        instance.ceContext = {
          addCEChildStyle: this._addChildStyles.bind(this),
          removeCEChildStyles: this._removeChildStyles.bind(this),
          setStyleAttrs: this._setStyleAttrs.bind(this),
        }
        // HMR
        if (__DEV__) {
          instance.ceReload = (newStyles?: string[] | undefined) => {
            // always reset styles
            if (this._styles) {
              this._styles.forEach(s => this.shadowRoot!.removeChild(s))
              this._styles.length = 0
            }
            this._childStylesSet.clear()
            this._applyStyles(newStyles)
            this._instance = null
            this._update()
          }
        }

        const dispatch = (event: string, args: any[]) => {
          this.dispatchEvent(
            new CustomEvent(event, {
              detail: args,
            }),
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
      styles.forEach((css, index) => {
        const s = document.createElement('style')
        s.textContent = css
        s.setAttribute(`data-v-ce-root`, '')
        this.shadowRoot!.appendChild(s)
        this._childStylesAnchor = s
        // record for HMR
        if (__DEV__) {
          ;(this._styles || (this._styles = [])).push(s)
        }
      })
    }
  }

  // The method used by custom element child components
  // to add styles to the shadow dom
  protected _addChildStyles(
    styles: string[] | undefined,
    uid: number,
    hasAttr: boolean,
  ) {
    if (styles) {
      // record style
      const isRepeated = this.isHasChildStyle(styles)
      if (isRepeated && !hasAttr) return

      styles.forEach((css, index) => {
        const s = document.createElement('style')
        s.textContent = css

        // set id for useCEStyleAttrs
        s.setAttribute(`data-v-ce-${uid}`, '')

        if (this._childStylesAnchor) {
          this.shadowRoot!.insertBefore(s, this._childStylesAnchor as Node)
        } else {
          this.shadowRoot!.appendChild(s)
        }
        // update anchor
        this._childStylesAnchor = s

        // record for HMR
        if (__DEV__) {
          ;(this._styles || (this._styles = [])).push(s)
        }
      })
    }
  }

  protected _setStyleAttrs(
    uid: number | 'root',
    nAttrs: Array<Record<string, string | number>>,
    oAttrs?: Array<Record<string, string | number>>,
  ) {
    const styleEls = this.shadowRoot!.querySelectorAll(`[data-v-ce-${uid}]`)
    styleEls.forEach((s, index) => {
      if (oAttrs && oAttrs[index]) {
        for (const key in oAttrs[index]) {
          if (
            nAttrs[index] &&
            !nAttrs[index].hasOwnProperty(nAttrs[index][key])
          ) {
            s.removeAttribute((oAttrs[index][key] || '').toString())
          }
        }
      }

      for (const key in nAttrs[index]) {
        s.setAttribute(key, (nAttrs[index][key] || '').toString())
      }
    })
  }

  protected _removeChildStyles(uid: number) {
    // remove style tag and _childStylesSet(for HMR)
    if (__DEV__) {
      const styleList = this.shadowRoot!.querySelectorAll(`[data-v-ce-${uid}]`)
      let oldStyleContentList: string[] = []
      styleList.length > 0 &&
        styleList.forEach(s => {
          oldStyleContentList.unshift(s.innerHTML as string)
          this.shadowRoot!.removeChild(s)
          // update anchor
          const anchor = this.shadowRoot!.querySelectorAll('style')
          this._childStylesAnchor =
            anchor.length > 0 ? anchor[anchor.length - 1] : undefined
        })
      this._childStylesSet.delete(oldStyleContentList.join())
    }
  }

  protected isHasChildStyle(styles: string[] | undefined) {
    if (styles) {
      const styleContent = styles.join()
      if (this._childStylesSet.has(styleContent)) {
        return true
      }
      this._childStylesSet.add(styleContent)
      return false
    }
  }
}
