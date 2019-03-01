import { Component, PropValidator } from '@vue/runtime-core'
import { camelize } from '@vue/shared'

export function prop(
  target: Component | PropValidator<any>,
  key?: string
): any {
  if (key) {
    applyProp(target, key)
  } else {
    const options = target as PropValidator<any>
    return (target: any, key: string) => {
      applyProp(target, key, options)
    }
  }
}

function applyProp(target: any, key: string, options: PropValidator<any> = {}) {
  // here `target` is the prototype of the component class
  Object.defineProperty(target, `__prop_${camelize(key)}`, {
    value: options
  })
}
