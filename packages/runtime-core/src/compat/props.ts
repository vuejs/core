import { DeprecationTypes, warnDeprecation } from './compatConfig'

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
