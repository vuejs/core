import { currentRenderingInstance } from '../componentRenderUtils'
import {
  currentInstance,
  Component,
  ComponentInternalInstance
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

export function resolveComponent(name: string): Component | undefined {
  return resolveAsset('components', name)
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
    return resolveAsset('components', component, instance)
  } else if (isFunction(component) || isObject(component)) {
    return component
  }
}

export function resolveDirective(name: string): Directive | undefined {
  return resolveAsset('directives', name)
}

// overload 1: components
function resolveAsset(
  type: 'components',
  name: string,
  instance?: ComponentInternalInstance
): Component | undefined
// overload 2: directives
function resolveAsset(
  type: 'directives',
  name: string,
  instance?: ComponentInternalInstance
): Directive | undefined

function resolveAsset(
  type: 'components' | 'directives',
  name: string,
  instance: ComponentInternalInstance | null = currentRenderingInstance ||
    currentInstance
) {
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
