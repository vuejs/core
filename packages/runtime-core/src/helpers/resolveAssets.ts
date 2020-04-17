import { currentRenderingInstance } from '../componentRenderUtils'
import { currentInstance, Component, FunctionalComponent } from '../component'
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

export function resolveComponent(name: string): Component | string | undefined {
  return resolveAsset(COMPONENTS, name) || name
}

export function resolveDynamicComponent(
  component: unknown
): Component | string | undefined {
  if (!component) return
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, false) || component
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
  warnMissing?: boolean
): Component | undefined
// overload 2: directives
function resolveAsset(
  type: typeof DIRECTIVES,
  name: string
): Directive | undefined

function resolveAsset(
  type: typeof COMPONENTS | typeof DIRECTIVES,
  name: string,
  warnMissing = true
) {
  const instance = currentRenderingInstance || currentInstance
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
    if (__DEV__ && warnMissing && !res) {
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
