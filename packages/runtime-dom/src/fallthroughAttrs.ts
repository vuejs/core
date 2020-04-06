import { isOn } from '@vue/shared'

type Data = Record<string, any>

export const getFallthroughAttrs = (attrs: Data) => {
  let res: Data | undefined
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || isOn(key)) {
      ;(res || (res = {}))[key] = attrs[key]
    }
  }
  return res
}
