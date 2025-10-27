import { extend, isPlainObject } from '@vue/shared'
import { createComponent, createVaporApp, defineVaporComponent } from '.'
import {
  type CreateAppFunction,
  type CustomElementOptions,
  VueElementBase,
  warn,
} from '@vue/runtime-dom'
import type {
  ObjectVaporComponent,
  VaporComponent,
  VaporComponentInstance,
} from './component'

export type VaporElementConstructor<P = {}> = {
  new (initialProps?: Record<string, any>): VaporElement & P
}

// TODO type inference

/*@__NO_SIDE_EFFECTS__*/
export function defineVaporCustomElement(
  options: any,
  extraOptions?: Omit<ObjectVaporComponent, 'setup'>,
  /**
   * @internal
   */
  _createApp?: CreateAppFunction<ParentNode, VaporComponent>,
): VaporElementConstructor {
  let Comp = defineVaporComponent(options, extraOptions)
  if (isPlainObject(Comp)) Comp = extend({}, Comp, extraOptions)
  class VaporCustomElement extends VaporElement {
    static def = Comp
    constructor(initialProps?: Record<string, any>) {
      super(Comp, initialProps, _createApp)
    }
  }

  return VaporCustomElement
}

/*@__NO_SIDE_EFFECTS__*/
export const defineVaporSSRCustomElement = ((
  options: any,
  extraOptions?: Omit<ObjectVaporComponent, 'setup'>,
) => {
  // @ts-expect-error
  return defineVaporCustomElement(options, extraOptions, createVaporSSRApp)
}) as typeof defineVaporCustomElement

type VaporInnerComponentDef = VaporComponent & CustomElementOptions

export class VaporElement extends VueElementBase<
  ParentNode,
  VaporComponent,
  VaporInnerComponentDef
> {
  constructor(
    def: VaporInnerComponentDef,
    props: Record<string, any> | undefined = {},
    createAppFn: CreateAppFunction<ParentNode, VaporComponent> = createVaporApp,
  ) {
    super(def, props, createAppFn)
  }

  protected _hasPreRendered(): boolean | undefined {
    if (this.shadowRoot && this._createApp !== createVaporApp) {
      this._root = this.shadowRoot
    } else {
      if (__DEV__ && this.shadowRoot) {
        warn(
          `Custom element has pre-rendered declarative shadow root but is not ` +
            `defined as hydratable. Use \`defineVaporSSRCustomElement\`.`,
        )
      }
      return true
    }
  }
  protected _mount(def: VaporInnerComponentDef): void {
    if ((__DEV__ || __FEATURE_PROD_DEVTOOLS__) && !def.name) {
      def.name = 'VaporElement'
    }

    this._app = this._createApp(this._def)
    this._inheritParentContext()
    if (this._def.configureApp) {
      this._def.configureApp(this._app)
    }

    this._app._ceComponent = this._createComponent()
    this._app!.mount(this._root)
  }

  protected _update(): void {
    if (!this._app) return
    // update component by re-running all its render effects
    const renderEffects = (this._instance! as VaporComponentInstance)
      .renderEffects
    if (renderEffects) renderEffects.forEach(e => e.run())
  }

  protected _unmount(): void {
    if (__TEST__) {
      try {
        this._app!.unmount()
      } catch (error) {
        // In test environment, ignore errors caused by accessing Node
        // after the test environment has been torn down
        if (
          error instanceof ReferenceError &&
          error.message.includes('Node is not defined')
        ) {
          // Ignore this error in tests
        } else {
          throw error
        }
      }
    } else {
      this._app!.unmount()
    }
    this._app = this._instance = null
  }

  private _createComponent() {
    this._def.ce = instance => {
      this._instance = instance
      if (!this.shadowRoot) {
        ;(instance.m || (instance.m = [])).push(this._renderSlots.bind(this))
        ;(instance.u || (instance.u = [])).push(this._renderSlots.bind(this))
      }
      this._processInstance()
      this._setParent()
    }

    this._instance = createComponent(this._def, this._props)
    return this._instance
  }
}
