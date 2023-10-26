import {
  ComponentOptionsMixin,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithObjectProps,
  ComponentOptionsWithoutProps,
  ComponentPropsOptions,
  ComponentPublicInstance,
  ComputedOptions,
  EmitsOptions,
  MethodOptions,
  RenderFunction,
  SetupContext,
  ComponentInternalInstance,
  VNode,
  RootHydrateFunction,
  ExtractPropTypes,
  createVNode,
  defineComponent,
  nextTick,
  warn,
  ConcreteComponent,
  ComponentOptions,
  ComponentInjectOptions,
  SlotsType
} from '@vue/runtime-core'
import {
  camelize,
  extend,
  hyphenate,
  isArray,
  isObject,
  isString,
  toNumber
} from '@vue/shared'
import { hydrate, render } from '.'

export type VueElementConstructor<P = {}> = {
  new (initialProps?: Record<string, any>): VueElement & P
}

const ceChildStyleMap = new Map<string, Set<string>>()

// defineCustomElement provides the same type inference as defineComponent
// so most of the following overloads should be kept in sync w/ defineComponent.

// overload 1: direct setup function
export function defineCustomElement<Props, RawBindings = object>(
  setup: (
    props: Readonly<Props>,
    ctx: SetupContext
  ) => RawBindings | RenderFunction
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
  S extends SlotsType = {}
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
  > & { styles?: string[] }
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
  S extends SlotsType = {}
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
  > & { styles?: string[] }
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
  S extends SlotsType = {}
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
  > & { styles?: string[] }
): VueElementConstructor<ExtractPropTypes<PropsOptions>>

// overload 5: defining a custom element from the returned value of
// `defineComponent`
export function defineCustomElement(options: {
  new (...args: any[]): ComponentPublicInstance
}): VueElementConstructor

/*! #__NO_SIDE_EFFECTS__ */
export function defineCustomElement(
  options: any,
  hydrate?: RootHydrateFunction
): VueElementConstructor {
  const Comp = defineComponent(options) as any
  class VueCustomElement extends VueElement {
    static def = Comp
    constructor(initialProps?: Record<string, any>) {
      super(Comp, initialProps, hydrate)
    }
  }

  return VueCustomElement
}

/*! #__NO_SIDE_EFFECTS__ */
export const defineSSRCustomElement = ((options: any) => {
  // @ts-ignore
  return defineCustomElement(options, hydrate)
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
  constructor(
    private _def: InnerComponentDef,
    private _props: Record<string, any> = {},
    hydrate?: RootHydrateFunction
  ) {
    super()
    if (this.shadowRoot && hydrate) {
      hydrate(this._createVNode(), this.shadowRoot)
    } else {
      if (__DEV__ && this.shadowRoot) {
        warn(
          `Custom element has pre-rendered declarative shadow root but is not ` +
            `defined as hydratable. Use \`defineSSRCustomElement\`.`
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
    if (this._ob) {
      this._ob.disconnect()
      this._ob = null
    }
    nextTick(() => {
      if (!this._connected) {
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
      const { props, styles, ceStylesAttrs } = def

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
      this._applyStyles(styles, ceStylesAttrs)

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
        }
      })
    }
  }

  protected _setAttr(key: string) {
    let value = this.getAttribute(key)
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
    shouldUpdate = true
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
          removeCEChildStylesMap: this._removeChildStylesMap.bind(this)
        }
        // HMR
        if (__DEV__) {
          instance.ceReload = (
            newStyles: string[] | undefined,
            attrs: ComponentInternalInstance['ceStylesAttrs']
          ) => {
            // always reset styles
            if (this._styles) {
              this._styles.forEach(s => this.shadowRoot!.removeChild(s))
              this._styles.length = 0
            }
            this._applyStyles(newStyles, attrs)
            this._instance = null
            this._update()
          }
        }

        const dispatch = (event: string, args: any[]) => {
          this.dispatchEvent(
            new CustomEvent(event, {
              detail: args
            })
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

  private _applyStyles(
    styles: string[] | undefined,
    attrs: ComponentInternalInstance['ceStylesAttrs']) {
    if (styles) {
      styles.forEach((css, index) => {
        const s = document.createElement('style')
        s.textContent = css
        if (attrs && attrs[index]) {
          this._setStyleAttrs(s, attrs[index])
        }
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
    attrs: ComponentInternalInstance['ceStylesAttrs'],
    uid: number
  ) {
    if (styles) {
      // record style
      const isRepeated = this._addChildStylesMap(styles, this._instance!.uid)
      if (isRepeated) return

      styles.forEach((css, index) => {
        const s = document.createElement('style')
        s.textContent = css
        if (attrs && attrs[index]) {
          this._setStyleAttrs(s, attrs[index])
        }
        // set id for hmr
        if(__DEV__){
          const ceStyleId = `data-v-ce-${uid}`
          s.setAttribute(ceStyleId, '')
        }

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

  // TODO: 子组件  unit-test
  // TODO: CE 根组件  unit-test
  // TODO: 多个 style 标签的顺序 unit-test
  // TODO: string 或 对象的测试  unit-test

  // TODO: 子組件的熱更新(attrs)
  // TODO: 子組件的熱更新(attrs) unit-test

  // TODO: 子組件的熱更新(style)
  // TODO: 子組件的熱更新(style) unit-test
  // TODO: CE 根组件热更新(attrs) ✅
  // TODO: CE 根组件热更新(style)
  // TODO: CE 根组件热更新(报错)
  // TODO: CE 根组件热更新(attrs) unit-test
  // TODO: CE 根组件热更新(style) unit-test
  protected _setStyleAttrs(
    s: HTMLStyleElement,
    attr: string | Record<string, string | number>
  ) {
    if (isString(attr)) {
      s.setAttribute(attr.toString(), '')
    } else if (isObject(attr)) {
      for (const key in attr) {
        s.setAttribute(key, attr[key].toString())
      }
    }
  }

  protected _removeChildStylesMap(styles: string[] | undefined, uid: number) {
    if (styles) {
      const styleContent = styles.join()
      if (ceChildStyleMap.has(styleContent)) {
        const ceUid = `__${this._instance!.uid}`
        // update ceUidSet
        const ceUidSet = ceChildStyleMap.get(styleContent)!
        ceUidSet.delete(ceUid)
        if (ceUidSet.size === 0) {
          // dev only
          if(__DEV__){
            // remove style tag
            const sList = this.shadowRoot!.querySelectorAll(`[data-v-ce-${uid}]`)
            sList.length > 0 &&
            sList.forEach(s => this.shadowRoot!.removeChild(s))
            // update archor
            const archor = this.shadowRoot!.querySelectorAll('style')
            this._childStylesAnchor =
              archor.length > 0 ? archor[archor.length - 1] : undefined
          }
          // clear ceChildStyleMap
          ceChildStyleMap.delete(styleContent)
        } else {
          // update ceChildStyleMap
          ceChildStyleMap.set(styleContent, ceUidSet)
        }
      }
    }
  }

  protected _addChildStylesMap(styles: string[] | undefined, uid: number) {
    if (styles) {
      const styleContent = styles.join()
      // ceChildStyleMap is global,
      // and a `CE` may be used multiple times,
      // so we need to maintain it at the granularity of the uid.
      // ceChildStyleMap = {
      //  [style1]: [uid1, uid2, ...]
      //  .....
      // }
      //            / - comp2
      //       / CE1  - comp2 --- Styles will not be added repeatedly
      // comp1
      //      \ comp3 - CE2 - comp2

      const ceUid = `__${uid}`
      let ceUidSet = new Set<string>()
      if (ceChildStyleMap.has(styleContent)) {
        ceUidSet = ceChildStyleMap.get(styleContent)!
        if (ceUidSet.has(ceUid)) {
          ceUidSet.add(ceUid)
          ceChildStyleMap.set(styleContent, ceUidSet)
          return true
        }
      }
      ceUidSet.add(ceUid)
      ceChildStyleMap.set(styleContent, ceUidSet)
      return false
    }
  }
}
