import { extend, isPlainObject } from '@vue/shared'
import { defineVaporComponent } from '.'
import {
  type CreateAppFunction,
  type CustomElementOptions,
  VueElementBase,
} from '@vue/runtime-dom'
import type { ObjectVaporComponent, VaporComponent } from './component'

export type VaporElementConstructor<P = {}> = {
  new (initialProps?: Record<string, any>): VaporElement & P
}

// TODO type inference

/*@__NO_SIDE_EFFECTS__*/
export function defineCustomElement(
  options: any,
  extraOptions?: Omit<ObjectVaporComponent, 'setup'>,
  /**
   * @internal
   */
  _createApp?: CreateAppFunction<Element>,
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

type VaporInnerComponentDef = VaporComponent & CustomElementOptions

export class VaporElement extends VueElementBase<VaporInnerComponentDef> {
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
