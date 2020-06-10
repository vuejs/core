import { currentRenderingInstance } from '../componentRenderUtils'
import {
  currentInstance,
  Component,
  FunctionalComponent,
  ComponentOptions
} from '../component'
import { Directive } from '../directives'
import { camelize, capitalize, isString, isObject } from '@vue/shared'
import { warn } from '../warning'

const COMPONENTS = 'components'
const DIRECTIVES = 'directives'

/**
 * @private
 */
export function resolveComponent(name: string): Component | string | undefined {
  return resolveAsset(COMPONENTS, name) || name
}

export const NULL_DYNAMIC_COMPONENT = Symbol()

/**
 * @private
 */
export function resolveDynamicComponent(
  component: unknown
): Component | string | typeof NULL_DYNAMIC_COMPONENT {
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, false) || component
  } else {
    // invalid types will fallthrough to createVNode and raise warning
    return (component as any) || NULL_DYNAMIC_COMPONENT
  }
}

/**
 * @private
 */
export function resolveDirective(name: string): Directive | undefined {
  return resolveAsset(DIRECTIVES, name)
}

/**
 * @private
 * overload 1: components
 */
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
// implementation
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
    if (__DEV__) {
      if (res) {
        // in dev, infer anonymous component's name based on registered name
        if (
          type === COMPONENTS &&
          isObject(res) &&
          !(res as ComponentOptions).name
        ) {
          ;(res as ComponentOptions).name = name
        }
      } else if (warnMissing) {
        warn(`Failed to resolve ${type.slice(0, -1)}: ${name}`)
      }
    }
    return res
  } else if (__DEV__) {
    warn(
      `resolve${capitalize(type.slice(0, -1))} ` +
        `can only be used in render() or setup().`
    )
  }
}
