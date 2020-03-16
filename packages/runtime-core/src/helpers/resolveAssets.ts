import { currentRenderingInstance } from '../componentRenderUtils'
import {
  currentInstance,
  Component,
  ComponentInternalInstance,
  FunctionalComponent
} from '../component'
import { Directive } from '../directives'
import {
  camelize,
  capitalize,
  isString,
  isObject,
  isFunction
} from '@vue/shared'
import { warn } from '../warning'

const COMPONENTS = 'components'
const DIRECTIVES = 'directives'

export function resolveComponent(name: string): Component | undefined {
  return resolveAsset(COMPONENTS, name)
}

export function resolveDynamicComponent(
  component: unknown
): Component | undefined {
  if (!component) return
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, currentRenderingInstance)
  } else if (isFunction(component) || isObject(component)) {
    return component
  }
}

export function resolveDirective(name: string): Directive | undefined {
  return resolveAsset(DIRECTIVES, name)
}

// overload 1: components
function resolveAsset(
  type: typeof COMPONENTS,
  name: string,
  instance?: ComponentInternalInstance | null
): Component | undefined
// overload 2: directives
function resolveAsset(
  type: typeof DIRECTIVES,
  name: string,
  instance?: ComponentInternalInstance | null
): Directive | undefined

function resolveAsset(
  type: typeof COMPONENTS | typeof DIRECTIVES,
  name: string,
  instance: ComponentInternalInstance | null = currentRenderingInstance ||
    currentInstance
) {
  if (instance) {
    let camelized, capitalized
    const registry = instance[type]
    let res =
      registry[name] ||
      registry[(camelized = camelize(name))] ||
      registry[(capitalized = capitalize(camelized))]
    if (!res && type === COMPONENTS) {
      const self = instance.type
      const selfName = (self as FunctionalComponent).displayName || self.name
      if (
        selfName &&
        (selfName === name ||
          selfName === camelized ||
          selfName === capitalized)
      ) {
        res = self
      }
    }
    if (__DEV__ && !res) {
      warn(`Failed to resolve ${type.slice(0, -1)}: ${name}`)
    }
    return res
  } else if (__DEV__) {
    warn(
      `resolve${capitalize(type.slice(0, -1))} ` +
        `can only be used in render() or setup().`
    )
  }
}
