import {
  type Component,
  createComponentInstance,
  currentInstance,
} from './component'
import { setupComponent } from './apiRender'
import type { RawProps } from './componentProps'

export function createComponent(comp: Component, rawProps: RawProps = null) {
  const current = currentInstance!
  const instance = createComponentInstance(comp, rawProps)
  setupComponent(instance)

  // register sub-component with current component for lifecycle management
  current.comps.add(instance)

  return instance.block
}
