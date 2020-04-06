import { Data } from '@vue/runtime-core/src/component'
import { isOn } from '@vue/shared'

export const getComponentFallthroughAttrs = (attrs: Data) => {
  let res: Data | undefined
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || isOn(key)) {
      ;(res || (res = {}))[key] = attrs[key]
    }
  }
  return res
}
