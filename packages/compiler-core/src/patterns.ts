/** Pattern grammar for the RFC 823 reference implementation. No JS evaluation. */
export interface PatternRange {
  start: number
  end: number
}

export type MatchPattern = PatternRange &
  (
    | { kind: 'wildcard' }
    | { kind: 'literal' | 'value'; text: string }
    | { kind: 'binding'; name: string }
    | { kind: 'as'; pattern: MatchPattern; binding: PatternBinding }
    | { kind: 'or'; patterns: MatchPattern[] }
    | { kind: 'object'; properties: PatternProperty[]; rest?: PatternRest }
    | { kind: 'array'; elements: MatchPattern[]; rest?: PatternRest }
  )

export interface PatternBinding extends PatternRange {
  name: string
}
export interface PatternProperty extends PatternRange {
  key: string
  keyText: string
  pattern: MatchPattern
}
export interface PatternRest extends PatternRange {
  binding?: PatternBinding
}
export interface MatchArm {
  pattern: MatchPattern
  bindings: PatternBinding[]
  guard?: PatternRange & { text: string }
}

export class PatternSyntaxError extends SyntaxError {
  constructor(
    message: string,
    public offset: number,
  ) {
    super(message)
  }
}

const identifier = /^[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*/u
const reserved = new Set(
  'await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof interface implements let new null package private protected public return static super switch this throw true try typeof var void while with yield eval arguments'.split(
    ' ',
  ),
)
const numeric =
  /^(?:0[xX][\da-fA-F]+n?|0[bB][01]+n?|0[oO][0-7]+n?|(?:0|[1-9]\d*)n|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/

export function parseMatchPattern(source: string): MatchArm {
  let pos = 0
  const bindings: PatternBinding[] = []
  const names = new Set<string>()
  const fail = (message: string): never => {
    throw new PatternSyntaxError(message, pos)
  }
  const space = () => {
    while (/\s/.test(source[pos] || '') && pos < source.length) pos++
  }
  const eat = (text: string) => {
    space()
    if (!source.startsWith(text, pos)) return false
    pos += text.length
    return true
  }
  const word = (text: string) => {
    space()
    if (
      !source.startsWith(text, pos) ||
      /^[$_\u200c\u200d\p{ID_Continue}]/u.test(source.slice(pos + text.length))
    )
      return false
    pos += text.length
    return true
  }
  const expect = (text: string) => {
    if (!eat(text)) fail(`Expected ${text} in pattern.`)
  }
  const name = () => {
    space()
    const start = pos
    const value = identifier.exec(source.slice(pos))?.[0]
    if (!value) return fail('Expected an identifier.')
    pos += value.length
    return { name: value, start, end: pos }
  }
  const bind = (): PatternBinding => {
    const result = name()
    if (reserved.has(result.name)) fail(`Invalid binding name ${result.name}.`)
    if (names.has(result.name))
      fail(`Duplicate pattern binding ${result.name}.`)
    names.add(result.name)
    bindings.push(result)
    return result
  }
  const string = () => {
    const start = pos
    const quote = source[pos++]
    let value = ''
    while (pos < source.length) {
      let char = source[pos++]
      if (char === quote) return { value, text: source.slice(start, pos) }
      if (char === '\n' || char === '\r')
        fail('Unterminated string in pattern.')
      if (char === '\\') {
        char = source[pos++]
        const escapes: Record<string, string> = {
          n: '\n',
          r: '\r',
          t: '\t',
          b: '\b',
          f: '\f',
          v: '\v',
          '0': '\0',
        }
        if (char === 'x' || char === 'u') {
          let hex: string
          if (char === 'u' && source[pos] === '{') {
            const end = source.indexOf('}', ++pos)
            if (end < 0) fail('Invalid Unicode escape.')
            hex = source.slice(pos, end)
            pos = end + 1
          } else {
            const size = char === 'x' ? 2 : 4
            hex = source.slice(pos, pos + size)
            if (hex.length !== size) fail('Invalid string escape.')
            pos += size
          }
          if (!/^[\da-f]+$/i.test(hex) || parseInt(hex, 16) > 0x10ffff)
            fail('Invalid string escape.')
          value += String.fromCodePoint(parseInt(hex, 16))
        } else if (
          /[1-9]/.test(char || '') ||
          (char === '0' && /\d/.test(source[pos] || ''))
        ) {
          fail('Legacy octal escapes are not supported.')
        } else if (char === '\n' || char === '\r' || !char) {
          fail('Invalid string escape.')
        } else value += escapes[char] ?? char
      } else value += char
    }
    return fail('Unterminated string in pattern.')
  }
  const rest = (close: string): PatternRest => {
    const start = pos - 3
    const binding = word('const') ? bind() : undefined
    space()
    if (source[pos] !== close)
      fail(
        'Rest must be last, without a trailing comma; use ... or ...const name.',
      )
    return { start, end: pos, binding }
  }
  const parse = (): MatchPattern => {
    let pattern = atom()
    const alternatives = [pattern]
    while (eat('|')) alternatives.push(atom())
    if (alternatives.length > 1) {
      if (alternatives.some(p => getPatternBindings(p).length))
        fail('Bindings inside or-patterns are not supported.')
      pattern = {
        kind: 'or',
        patterns: alternatives,
        start: pattern.start,
        end: pos,
      }
    }
    if (word('as')) {
      const binding = bind()
      pattern = { kind: 'as', pattern, binding, start: pattern.start, end: pos }
    }
    return pattern
  }
  const atom = (): MatchPattern => {
    space()
    const start = pos
    if (eat('(')) {
      const pattern = parse()
      expect(')')
      return { ...pattern, start, end: pos }
    }
    if (eat('{')) {
      const properties: PatternProperty[] = []
      const keys = new Set<string>()
      let remainder: PatternRest | undefined
      while (!eat('}')) {
        if (eat('...')) {
          remainder = rest('}')
          expect('}')
          break
        }
        space()
        const keyStart = pos
        let key: string
        let keyText: string
        let pattern: MatchPattern
        if (word('const')) {
          const binding = bind()
          key = binding.name
          keyText = JSON.stringify(key)
          pattern = { kind: 'binding', ...binding }
        } else {
          if (source[pos] === "'" || source[pos] === '"') {
            const token = string()
            key = token.value
            keyText = token.text
          } else {
            const number = numeric.exec(source.slice(pos))?.[0]
            if (number) {
              pos += number.length
              if (number.endsWith('n'))
                fail('Bigint object keys are not supported.')
              key = String(Number(number))
              keyText = JSON.stringify(key)
            } else {
              key = name().name
              keyText = JSON.stringify(key)
            }
          }
          expect(':')
          pattern = parse()
        }
        if (keys.has(key)) fail(`Duplicate pattern property ${key}.`)
        keys.add(key)
        properties.push({ key, keyText, pattern, start: keyStart, end: pos })
        if (eat('}')) break
        expect(',')
      }
      return { kind: 'object', properties, rest: remainder, start, end: pos }
    }
    if (eat('[')) {
      const elements: MatchPattern[] = []
      let remainder: PatternRest | undefined
      while (!eat(']')) {
        if (eat('...')) {
          remainder = rest(']')
          expect(']')
          break
        }
        elements.push(parse())
        if (eat(']')) break
        expect(',')
      }
      return { kind: 'array', elements, rest: remainder, start, end: pos }
    }
    if (word('const')) return { kind: 'binding', ...bind() }
    if (word('let') || word('var'))
      fail('Only const pattern bindings are supported.')
    if (source[pos] === "'" || source[pos] === '"') {
      const token = string()
      return { kind: 'literal', text: token.text, start, end: pos }
    }
    const sign = source[pos] === '-' || source[pos] === '+' ? source[pos++] : ''
    const number = numeric.exec(source.slice(pos))?.[0]
    if (number) {
      pos += number.length
      if (sign === '+' && number.endsWith('n'))
        fail('Unary plus cannot be used with bigint.')
      return { kind: 'literal', text: sign + number, start, end: pos }
    }
    if (sign) fail('Expected a numeric literal after sign.')
    const value = name()
    if (value.name === '_') return { kind: 'wildcard', start, end: pos }
    if (['true', 'false', 'null'].includes(value.name))
      return { kind: 'literal', text: value.name, start, end: pos }
    if (reserved.has(value.name))
      fail('Expected a literal, value or structural pattern.')
    while (true) {
      if (eat('.')) name()
      else if (eat('[')) {
        space()
        if (source[pos] === "'" || source[pos] === '"') string()
        else {
          const number = numeric.exec(source.slice(pos))?.[0]
          if (number) pos += number.length
          else name()
        }
        expect(']')
      } else break
    }
    return {
      kind: 'value',
      text: source.slice(start, pos).trim(),
      start,
      end: pos,
    }
  }
  const pattern = parse()
  let guard: MatchArm['guard']
  if (word('if')) {
    expect('(')
    const start = pos
    const end = source.trimEnd().length - 1
    if (source[end] !== ')' || !source.slice(start, end).trim())
      fail('Expected if (guard).')
    guard = { text: source.slice(start, end), start, end }
    pos = end + 1
  }
  space()
  if (pos !== source.length) fail('Unexpected token in pattern.')
  return { pattern, bindings, guard }
}

export function getPatternBindings(pattern: MatchPattern): PatternBinding[] {
  switch (pattern.kind) {
    case 'binding':
      return [pattern]
    case 'as':
      return [...getPatternBindings(pattern.pattern), pattern.binding]
    case 'or':
      return pattern.patterns.flatMap(getPatternBindings)
    case 'array':
      return [
        ...pattern.elements.flatMap(getPatternBindings),
        ...(pattern.rest?.binding ? [pattern.rest.binding] : []),
      ]
    case 'object':
      return [
        ...pattern.properties.flatMap(p => getPatternBindings(p.pattern)),
        ...(pattern.rest?.binding ? [pattern.rest.binding] : []),
      ]
    default:
      return []
  }
}

/** Emit a lazy selector. Values/bindings are local to each attempted arm. */
export function generateMatchSelector(
  arms: MatchArm[],
  subject: string,
  prefix: string,
): { code: string; subjectOffset: number } {
  let nextId = 0
  const temp = () => `${prefix}_${nextId++}`
  const root = temp()
  const branches = arms.map((arm, index) => {
    // RFC evaluation order: test the shape, copy bound rest, introduce bindings,
    // then evaluate the guard. A failed test must not read a discarded rest.
    const tests: string[] = []
    const declarations: string[] = []
    const copies: string[] = []
    const emit = (pattern: MatchPattern, value: string): void => {
      switch (pattern.kind) {
        case 'wildcard':
          return
        case 'binding':
          declarations.push(`const ${pattern.name} = ${value};`)
          return
        case 'as':
          emit(pattern.pattern, value)
          declarations.push(`const ${pattern.binding.name} = ${value};`)
          return
        case 'literal':
          tests.push(`if (!(${value} === ${pattern.text})) return null;`)
          return
        case 'value': {
          const expected = temp()
          tests.push(
            `const ${expected} = ${pattern.text}; if (!(${value} === ${expected} || (${value} !== ${value} && ${expected} !== ${expected}))) return null;`,
          )
          return
        }
        case 'or': {
          const alternatives = pattern.patterns.map(p => {
            const start = tests.length
            emit(p, value)
            return `(() => { ${tests.splice(start).join(' ')} return true; })()`
          })
          tests.push(`if (!(${alternatives.join(' || ')})) return null;`)
          return
        }
        case 'object': {
          tests.push(`if (${value} == null) return null;`)
          for (const property of pattern.properties) {
            tests.push(
              `if (!(${property.keyText} in Object(${value}))) return null;`,
            )
            if (property.pattern.kind !== 'wildcard') {
              const child = temp()
              tests.push(`const ${child} = ${value}[${property.keyText}];`)
              emit(property.pattern, child)
            }
          }
          if (pattern.rest?.binding) {
            const copy = temp()
            const key = temp()
            const keys = pattern.properties
              .map(p => JSON.stringify(p.key))
              .join(', ')
            copies.push(
              `const ${copy} = {}; ` +
                `for (const ${key} of Object.getOwnPropertyNames(Object(${value}))` +
                `.concat(Object.getOwnPropertySymbols(Object(${value})))) { ` +
                `if (![${keys}].includes(${key}) && ` +
                `Object.prototype.propertyIsEnumerable.call(${value}, ${key})) ` +
                `Object.defineProperty(${copy}, ${key}, { value: ${value}[${key}], ` +
                `enumerable: true, configurable: true, writable: true }); }`,
            )
            declarations.push(`const ${pattern.rest.binding.name} = ${copy};`)
          }
          return
        }
        case 'array':
          tests.push(
            `if (!Array.isArray(${value}) || !(${value}.length ${pattern.rest ? '>=' : '==='} ${pattern.elements.length})) return null;`,
          )
          pattern.elements.forEach((p, i) => {
            if (p.kind === 'wildcard') return
            const child = temp()
            tests.push(`const ${child} = ${value}[${i}];`)
            emit(p, child)
          })
          if (pattern.rest?.binding) {
            // Array.from avoids custom slice/species and copies sparse values.
            const copy = temp()
            copies.push(
              `const ${copy} = Array.from({ length: ${value}.length - ${pattern.elements.length} }, (_, i) => ${value}[i + ${pattern.elements.length}]);`,
            )
            declarations.push(`const ${pattern.rest.binding.name} = ${copy};`)
          }
      }
    }
    emit(arm.pattern, root)
    const result = temp()
    const guard = arm.guard ? `if (!(${arm.guard.text})) return null;` : ''
    const values = arm.bindings.map(binding => `, ${binding.name}`).join('')
    // This inner block keeps pattern value lookups outside a binding's TDZ.
    const body =
      `${tests.join(' ')} ${copies.join(' ')} ` +
      `{ ${declarations.join(' ')} ${guard} return [${index}${values}]; }`
    return (
      `{ const ${result} = (() => { ${body} })(); ` +
      `if (${result} !== null) return ${result}; }`
    )
  })
  const selector = `((${root}) => { ${branches.join(' ')} return [-1]; })(`
  return { code: `${selector}${subject})`, subjectOffset: selector.length }
}
