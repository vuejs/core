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
  ComponentOptions
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
  EE extends string = string
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
    EE
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
  EE extends string = string
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
    EE
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
  EE extends string = string
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
    EE
  > & { styles?: string[] }
): VueElementConstructor<ExtractPropTypes<PropsOptions>>

// overload 5: defining a custom element from the returned value of
// `defineComponent`
export function defineCustomElement(options: {
  new (...args: any[]): ComponentPublicInstance
}): VueElementConstructor

export function defineCustomElement(
  options: any,
  hydrate?: RootHydrateFunction
): VueElementConstructor {
  const Comp = defineComponent(options as any)
  class VueCustomElement extends VueElement {
    static def = Comp
    constructor(initialProps?: Record<string, any>) {
      super(Comp, initialProps, hydrate)
    }
  }

  return VueCustomElement
}

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
    }
  }

  connectedCallback() {
    this._connected = true
    if (!this._instance) {
      this._resolveDef()
    }
  }

  disconnectedCallback() {
    this._connected = false
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
    if (this._resolved) {
      return
    }
    this._resolved = true

    // set initial attrs
    for (let i = 0; i < this.attributes.length; i++) {
      this._setAttr(this.attributes[i].name)
    }

    // watch future attr changes
    new MutationObserver(mutations => {
      for (const m of mutations) {
        this._setAttr(m.attributeName!)
      }
    }).observe(this, { attributes: true })

    const resolve = (def: InnerComponentDef) => {
      const { props } = def
      const hasOptions = !isArray(props)
      const rawKeys = props ? (hasOptions ? Object.keys(props) : props) : []

      // cast Number-type props set before resolve
      let numberProps
      if (hasOptions) {
        for (const key in this._props) {
          const opt = props[key]
          if (opt === Number || (opt && opt.type === Number)) {
            this._props[key] = toNumber(this._props[key])
            ;(numberProps || (numberProps = Object.create(null)))[key] = true
          }
        }
      }
      this._numberProps = numberProps

      // check if there are props set pre-upgrade or connect
      for (const key of Object.keys(this)) {
        if (key[0] !== '_') {
          this._setProp(key, this[key as keyof this], true, false)
        }
      }

      // defining getter/setters on prototype
      for (const key of rawKeys.map(camelize)) {
        Object.defineProperty(this, key, {
          get() {
            return this._getProp(key)
          },
          set(val) {
            this._setProp(key, val)
          }
        })
      }

      // apply CSS
      this._applyStyles(def)

      // initial render
      this._update()
    }

    const asyncDef = (this._def as ComponentOptions).__asyncLoader
    if (asyncDef) {
      asyncDef().then(resolve)
    } else {
      resolve(this._def)
    }
  }

  protected _setAttr(key: string) {
    let value = this.getAttribute(key)
    if (this._numberProps && this._numberProps[key]) {
      value = toNumber(value)
    }
    this._setProp(camelize(key), value, false)
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
        // HMR
        if (__DEV__) {
          instance.ceReload = newComponent => {
            // always reset styles
            if (this._styles) {
              this._styles.forEach(s => this.shadowRoot!.removeChild(s))
              this._styles.length = 0
            }
            this._applyStyles(newComponent)
            // if this is an async component, ceReload is called from the inner
            // component so no need to reload the async wrapper
            if (!(this._def as ComponentOptions).__asyncLoader) {
              // reload
              this._instance = null
              this._update()
            }
          }
        }

        // intercept emit
        instance.emit = (event: string, ...args: any[]) => {
          this.dispatchEvent(
            new CustomEvent(event, {
              detail: args
            })
          )
        }

        // locate nearest Vue custom element parent for provide/inject
        let parent: Node | null = this
        while (
          (parent =
            parent && (parent.parentNode || (parent as ShadowRoot).host))
        ) {
          if (parent instanceof VueElement) {
            instance.parent = parent._instance
            break
          }
        }
      }
    }
    return vnode
  }

  private _applyStyles(def: InnerComponentDef) {
    const options = def as ComponentOptions;

    if (options.__asyncLoader) {
      options.__asyncLoader().then(this._applyStyles.bind(this));
      return;
    }
    if (options.styles) {
      for (const style of options.styles) {
        const tag = document.createElement("style");
        tag.textContent = style;
        this.shadowRoot!.appendChild(tag);
        // record for HMR
        if (__DEV__) {
          (this._styles || (this._styles = [])).push(tag)
        }
      }
    }
    if (options.components) {
      for (const sub of Object.values(options.components)) {
        this._applyStyles(sub as ComponentOptions);
      }
    }
  }
}
