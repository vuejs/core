import { currentRenderingInstance } from '../componentRenderUtils'
import { currentInstance, Component } from '../component'
import { Directive } from '../directives'
import {
  camelize,
  capitalize,
  isString,
  isObject,
  isFunction
} from '@vue/shared'
import { warn } from '../warning'

export function resolveComponent(name: string): Component | undefined {
  return resolveAsset('components', name)
}

export function resolveDynamicComponent(
  component: unknown
): Component | undefined {
  if (!component) return
  if (isString(component)) {
    return resolveAsset('components', component)
  } else if (isFunction(component) || isObject(component)) {
    return component
  }
}

export function resolveDirective(name: string): Directive | undefined {
  return resolveAsset('directives', name)
}

// overload 1: components
function resolveAsset(type: 'components', name: string): Component | undefined
// overload 2: directives
function resolveAsset(type: 'directives', name: string): Directive | undefined

function resolveAsset(type: 'components' | 'directives', name: string) {
  const instance = currentRenderingInstance || currentInstance
  if (instance) {
    let camelized
    const registry = instance[type]
    const res =
      registry[name] ||
      registry[(camelized = camelize(name))] ||
      registry[capitalize(camelized)]
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
