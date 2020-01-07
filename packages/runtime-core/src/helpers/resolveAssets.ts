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
  component: unknown,
  // Dynamic component resolution has to be called inline due to potential
  // access to scope variables. When called inside slots it will be inside
  // a different component's render cycle, so the owner instance must be passed
  // in explicitly.
  instance: ComponentInternalInstance
): Component | undefined {
  if (!component) return
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, instance)
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
  instance?: ComponentInternalInstance
): Component | undefined
// overload 2: directives
function resolveAsset(
  type: typeof DIRECTIVES,
  name: string,
  instance?: ComponentInternalInstance
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
