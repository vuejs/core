import { camelize, capitalize, isString } from '@vue/shared'
import { warn } from '../warning'
import type { Directive } from '../directives'
import { type Component, currentInstance } from '../component'
import { getComponentName } from '../component'

const COMPONENTS = 'components'
const DIRECTIVES = 'directives'

export type AssetTypes = typeof COMPONENTS | typeof DIRECTIVES

export function resolveComponent(name: string): string | Component {
  return resolveAsset(COMPONENTS, name, true) || name
}

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
  warnMissing?: boolean,
): Component | undefined
// overload 2: directives
function resolveAsset(
  type: typeof DIRECTIVES,
  name: string,
): Directive | undefined
// implementation
function resolveAsset(type: AssetTypes, name: string, warnMissing = true) {
  const instance = currentInstance
  if (instance) {
    const Component = instance.type

    // explicit self name has highest priority
    if (type === COMPONENTS) {
      const selfName = getComponentName(Component)
      if (
        selfName &&
        (selfName === name ||
          selfName === camelize(name) ||
          selfName === capitalize(camelize(name)))
      ) {
        return Component
      }
    }

    const res =
      // global registration
      resolve(instance.appContext[type], name)

    if (__DEV__ && warnMissing && !res) {
      const extra =
        type === COMPONENTS
          ? `\nIf this is a native custom element, make sure to exclude it from ` +
            `component resolution via compilerOptions.isCustomElement.`
          : ``
      warn(`Failed to resolve ${type.slice(0, -1)}: ${name}${extra}`)
    }

    return res
  } else if (__DEV__) {
    warn(
      `resolve${capitalize(type.slice(0, -1))} ` +
        `can only be used in render() or setup().`,
    )
  }
}

function resolve(registry: Record<string, any> | undefined, name: string) {
  return (
    registry &&
    (registry[name] ||
      registry[camelize(name)] ||
      registry[capitalize(camelize(name))])
  )
}

/**
 * @private
 */
export function resolveDynamicComponent(
  component: string | Component,
): string | Component {
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, false) || component
  } else {
    return component
  }
}
