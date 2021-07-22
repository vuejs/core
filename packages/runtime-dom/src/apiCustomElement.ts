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
  hydate?: RootHydrateFunction
): VueElementConstructor {
  const Comp = defineComponent(options as any)
  const { props } = options
  const rawKeys = props ? (isArray(props) ? props : Object.keys(props)) : []
  const attrKeys = rawKeys.map(hyphenate)
  const propKeys = rawKeys.map(camelize)

  class VueCustomElement extends VueElement {
    static def = Comp
    static get observedAttributes() {
      return attrKeys
    }
    constructor(initialProps?: Record<string, any>) {
      super(Comp, initialProps, attrKeys, propKeys, hydate)
    }
  }

  for (const key of propKeys) {
    Object.defineProperty(VueCustomElement.prototype, key, {
      get() {
        return this._getProp(key)
      },
      set(val) {
        this._setProp(key, val)
      }
    })
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

export class VueElement extends BaseClass {
  /**
   * @internal
   */
  _instance: ComponentInternalInstance | null = null
  /**
   * @internal
   */
  _connected = false

  constructor(
    private _def: ComponentOptions & { styles?: string[] },
    private _props: Record<string, any> = {},
    private _attrKeys: string[],
    private _propKeys: string[],
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
      this._applyStyles()
    }
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (this._attrKeys.includes(name)) {
      this._setProp(camelize(name), toNumber(newValue), false)
    }
  }

  connectedCallback() {
    this._connected = true
    if (!this._instance) {
      // check if there are props set pre-upgrade
      for (const key of this._propKeys) {
        if (this.hasOwnProperty(key)) {
          const value = (this as any)[key]
          delete (this as any)[key]
          this._setProp(key, value)
        }
      }
      render(this._createVNode(), this.shadowRoot!)
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
   * @internal
   */
  protected _getProp(key: string) {
    return this._props[key]
  }

  /**
   * @internal
   */
  protected _setProp(key: string, val: any, shouldReflect = true) {
    if (val !== this._props[key]) {
      this._props[key] = val
      if (this._instance) {
        render(this._createVNode(), this.shadowRoot!)
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

  private _createVNode(): VNode<any, any> {
    const vnode = createVNode(this._def, extend({}, this._props))
    if (!this._instance) {
      vnode.ce = instance => {
        this._instance = instance
        instance.isCE = true
        // HMR
        if (__DEV__) {
          instance.appContext.reload = () => {
            render(this._createVNode(), this.shadowRoot!)
            this.shadowRoot!.querySelectorAll('style').forEach(s => {
              this.shadowRoot!.removeChild(s)
            })
            this._applyStyles()
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

  private _applyStyles() {
    if (this._def.styles) {
      this._def.styles.forEach(css => {
        const s = document.createElement('style')
        s.textContent = css
        this.shadowRoot!.appendChild(s)
      })
    }
  }
}
