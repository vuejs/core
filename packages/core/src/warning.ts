import { MountedComponent, ComponentType } from './component'

let currentComponent: MountedComponent | null = null
let currentComponentDefinition: ComponentType | null = null

export function setCurrentComponent(c: MountedComponent) {
  currentComponent = c
}

export function unsetCurrentComponent() {
  currentComponent = null
}

export function setCurrentComponentDefinition(d: ComponentType) {
  currentComponentDefinition = d
}

export function unsetCurrentComponentDefinition() {
  currentComponentDefinition = null
}
