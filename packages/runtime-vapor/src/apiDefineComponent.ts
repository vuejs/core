import type { ObjectVaporComponent, VaporComponent } from './component'
import { extend, isFunction } from '@vue/shared'

/*! #__NO_SIDE_EFFECTS__ */
export function defineVaporComponent(
  comp: VaporComponent,
  extraOptions?: Omit<ObjectVaporComponent, 'setup'>,
): VaporComponent {
  if (isFunction(comp)) {
    // #8236: extend call and options.name access are considered side-effects
    // by Rollup, so we have to wrap it in a pure-annotated IIFE.
    return /*@__PURE__*/ (() =>
      extend({ name: comp.name }, extraOptions, {
        setup: comp,
        __vapor: true,
      }))()
  }
  // TODO type inference
  comp.__vapor = true
  return comp
}
