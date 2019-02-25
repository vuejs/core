import { PropValidator, Component } from '@vue/runtime-core'

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
  Object.defineProperty(target, `__prop_${key}`, {
    value: options
  })
}
