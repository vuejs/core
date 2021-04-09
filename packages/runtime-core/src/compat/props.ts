import { DeprecationTypes, warnDeprecation } from './deprecations'

export function createPropsDefaultThis(propKey: string) {
  return new Proxy(
    {},
    {
      get() {
        warnDeprecation(DeprecationTypes.PROPS_DEFAULT_THIS, null, propKey)
      }
    }
  )
}
