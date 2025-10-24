import { extend, isPlainObject } from '@vue/shared'
import { createVaporApp, defineVaporComponent } from '.'
import {
  type CreateAppFunction,
  type CustomElementOptions,
  VueElementBase,
  warn,
} from '@vue/runtime-dom'
import type { ObjectVaporComponent, VaporComponent } from './component'

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
  protected _mountComponent(def: VaporInnerComponentDef): void {
    throw new Error('Method not implemented.')
  }
  protected _updateComponent(): void {
    throw new Error('Method not implemented.')
  }
  protected _unmountComponent(): void {
    throw new Error('Method not implemented.')
  }
}
