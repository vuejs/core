import { isArray, isString, isObject, hyphenate } from './'
import { isNoUnitNumericStyleProp } from './domAttrConfig'

export function normalizeStyle(
  value: unknown
): Record<string, string | number> | undefined {
  if (isArray(value)) {
    const res: Record<string, string | number> = {}
    for (let i = 0; i < value.length; i++) {
      const styles = isString(value[i]) ? strStyleToObj(value[i]) : value[i]
      const normalized = normalizeStyle(styles)
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  } else if (isObject(value)) {
    return value
  }
}

function strStyleToObj(style: string) {
  const ret: Record<string, string | number> = {}
  style
    .replace(/\s*/g, '')
    .split(';')
    .forEach((item: string) => {
      const [key, val] = item.split(':')
      ret[key] = isNaN(Number(val)) ? val : Number(val)
    })
  return ret
}

export function stringifyStyle(
  styles: Record<string, string | number> | undefined
): string {
  let ret = ''
  if (!styles) {
    return ret
  }
  for (const key in styles) {
    const value = styles[key]
    const normalizedKey = key.startsWith(`--`) ? key : hyphenate(key)
    if (
      isString(value) ||
      (typeof value === 'number' && isNoUnitNumericStyleProp(normalizedKey))
    ) {
      // only render valid values
      ret += `${normalizedKey}:${value};`
    }
  }
  return ret
}

export function normalizeClass(value: unknown): string {
  let res = ''
  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      res += normalizeClass(value[i]) + ' '
    }
  } else if (isObject(value)) {
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}
