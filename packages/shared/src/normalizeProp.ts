import { hyphenate, isArray, isObject, isString } from './general'

export type NormalizedStyle = Record<string, string | number>

export function normalizeStyle(
  value: unknown,
): NormalizedStyle | string | undefined {
  if (isArray(value)) {
    const res: NormalizedStyle = {}
    for (let i = 0; i < value.length; i++) {
      const item = value[i]
      const normalized = isString(item)
        ? parseStringStyle(item)
        : (normalizeStyle(item) as NormalizedStyle)
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  } else if (isString(value) || isObject(value)) {
    return value
  }
}

const listDelimiterRE = /;(?![^(]*\))/g
const propertyDelimiterRE = /:([^]+)/
const styleCommentRE = /\/\*[^]*?\*\//g

export function parseStringStyle(cssText: string): NormalizedStyle {
  const ret: NormalizedStyle = {}
  cssText
    .replace(styleCommentRE, '')
    .split(listDelimiterRE)
    .forEach(item => {
      if (item) {
        const tmp = item.split(propertyDelimiterRE)
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim())
      }
    })
  return ret
}

export function stringifyStyle(
  styles: NormalizedStyle | string | undefined,
): string {
  if (!styles) return ''
  if (isString(styles)) return styles

  let ret = ''
  for (const key in styles) {
    const value = styles[key]
    if (isString(value) || typeof value === 'number') {
      const normalizedKey = key.startsWith(`--`) ? key : hyphenate(key)
      // only render valid values
      ret += `${normalizedKey}:${value};`
    }
  }
  return ret
}

export function normalizeClass(value: unknown): string {
  // do not implicitly deduplicate classes if user duplicates same class
  const classes: (string | undefined)[] = []
  // keep track of where in the above array each class name is specified
  // to allow e.g. `<p class="my-class" :class="{ 'my-class': false }">`
  // to remove `my-class` from the element
  const classIndexes = new Map<string, number[]>()

  normalizeClassHelper(value, classes, classIndexes)

  let str = ''
  for (const klass of classes) {
    if (klass) {
      str += klass + ' '
    }
  }
  return str.trim()
}

function normalizeClassHelper(
  value: unknown,
  classes: (string | undefined)[],
  classIndexes: Map<string, number[]>,
): void {
  if (isString(value)) {
    const splitClasses = value.trim().split(/\s+/)
    for (const klass of splitClasses) {
      if (!classIndexes.has(klass)) {
        classIndexes.set(klass, [])
      }
      classIndexes.get(klass)!.push(classes.length)
      classes.push(klass)
    }
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      normalizeClassHelper(value[i], classes, classIndexes)
    }
  } else if (isObject(value)) {
    for (const names in value) {
      const splitClasses = names.trim().split(/\s+/)
      for (const klass of splitClasses) {
        if (value[names]) {
          if (!classIndexes.has(klass)) {
            classIndexes.set(klass, [])
          }
          classIndexes.get(klass)!.push(classes.length)
          classes.push(klass)
        } else {
          const indexes = classIndexes.get(klass)
          if (indexes) {
            for (const i of indexes) {
              classes[i] = undefined
            }
            classIndexes.set(klass, [])
          }
        }
      }
    }
  }
}

export function normalizeProps(
  props: Record<string, any> | null,
): Record<string, any> | null {
  if (!props) return null
  let { class: klass, style } = props
  if (klass && !isString(klass)) {
    props.class = normalizeClass(klass)
  }
  if (style) {
    props.style = normalizeStyle(style)
  }
  return props
}
