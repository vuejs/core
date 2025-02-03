import type { VaporComponent } from './component'

/*! #__NO_SIDE_EFFECTS__ */
export function defineVaporComponent(comp: VaporComponent): VaporComponent {
  // TODO type inference
  comp.__vapor = true
  return comp
}
