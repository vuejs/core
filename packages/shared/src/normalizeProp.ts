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

const propertyDelimiterRE = /:([^]+)/
// Match strings and escapes first to preserve comment-like text in CSS values.
const styleCommentRE =
  /"(?:[^"\\]|\\[^])*"|'(?:[^'\\]|\\[^])*'|\\[^]|\/\*[^]*?\*\//g
const cssNameCharRE = /[-\w\u0080-\uFFFF]/
const cssWhitespaceRE = /[\t\n\f\r ]/
const cssEscapeRE = /\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|([^\n\r\f]))/iy

export function parseStringStyle(cssText: string): NormalizedStyle {
  const ret: NormalizedStyle = {}
  const text = cssText.replace(styleCommentRE, match =>
    match.startsWith('/*') ? '' : match,
  )
  let start = 0
  const delimiters: string[] = []
  let quote = ''
  let identifier = ''
  // Only a `;` outside of strings and blocks ends a declaration, e.g.
  // `--sep: ';'`, `--tokens: [a; b]` or `url(data:image/png;base64,...)`.
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '\\') {
      cssEscapeRE.lastIndex = i
      const escaped = !quote && cssEscapeRE.exec(text)
      if (escaped) {
        const code = escaped[1] ? parseInt(escaped[1], 16) : 0
        // Only ASCII escapes can form the special URL identifier.
        const decoded = escaped[1]
          ? code < 128
            ? String.fromCharCode(code)
            : '\uFFFD'
          : escaped[2]
        identifier = identifier.length < 3 ? identifier + decoded : 'other'
        i = cssEscapeRE.lastIndex - 1
      } else {
        i++
        identifier = ''
      }
      continue
    } else if (quote) {
      if (char === quote) quote = ''
      continue
    } else if (char === '"' || char === "'") {
      quote = char
      identifier = ''
      continue
    } else if (char === '(') {
      if (identifier.toLowerCase() === 'url') {
        let next = i + 1
        while (cssWhitespaceRE.test(text[next])) next++
        if (text[next] !== '"' && text[next] !== "'") {
          // Unquoted URL tokens end at the first unescaped `)`. Their
          // brackets, braces and semicolons are not nested CSS blocks.
          for (i = next; i < text.length; i++) {
            if (text[i] === '\\') i++
            else if (text[i] === ')') break
          }
          identifier = ''
          continue
        }
      }
      delimiters.push(')')
    } else if (char === '[') {
      delimiters.push(']')
    } else if (char === '{') {
      delimiters.push('}')
    } else if (char === delimiters[delimiters.length - 1]) {
      delimiters.pop()
    } else if (char === ';' && !delimiters.length) {
      parseDeclaration(text.slice(start, i), ret)
      start = i + 1
    }
    if (char === '#' || char === '@') {
      // Hashes and at-keywords include the following name, not a URL function.
      identifier = 'other'
    } else if (char === '-' && text.slice(i - 3, i) === '<!-') {
      identifier = '' // An HTML comment opener is a separate CSS token.
    } else {
      // Longer identifiers cannot be `url`; avoid retaining arbitrarily long names.
      identifier = cssNameCharRE.test(char)
        ? identifier.length < 3
          ? identifier + char
          : 'other'
        : ''
    }
  }
  parseDeclaration(text.slice(start), ret)
  return ret
}

function parseDeclaration(item: string, ret: NormalizedStyle): void {
  const tmp = item.split(propertyDelimiterRE)
  tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim())
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
  let res = ''
  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
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
