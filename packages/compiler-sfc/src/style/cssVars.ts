import {
  type BindingMetadata,
  NodeTypes,
  type SimpleExpressionNode,
  createRoot,
  createSimpleExpression,
  createTransformContext,
  processExpression,
} from '@vue/compiler-dom'
import type { SFCDescriptor } from '../parse'
import type { PluginCreator } from 'postcss'
import hash from 'hash-sum'
import { getEscapedCssVarName } from '@vue/shared'

export const CSS_VARS_HELPER = `useCssVars`

export function getCssVarsHelper(vapor: boolean | undefined): string {
  return vapor ? `useVaporCssVars` : CSS_VARS_HELPER
}

export function genCssVarsFromList(
  vars: string[],
  id: string,
  isProd: boolean,
  isSSR = false,
): string {
  return `{\n  ${vars
    .map(
      key =>
        // The `:` prefix here is used in `ssrRenderStyle` to distinguish whether
        // a custom property comes from `ssrCssVars`. If it does, we need to reset
        // its value to `initial` on the component instance to avoid unintentionally
        // inheriting the same property value from a different instance of the same
        // component in the outer scope.
        `"${isSSR ? `:--` : ``}${genVarName(id, key, isProd, isSSR)}": (${key})`,
    )
    .join(',\n  ')}\n}`
}

function genVarName(
  id: string,
  raw: string,
  isProd: boolean,
  isSSR = false,
): string {
  if (isProd) {
    // hash must not start with a digit to comply with CSS custom property naming rules
    return hash(id + raw).replace(/^\d/, r => `v${r}`)
  } else {
    // escape ASCII Punctuation & Symbols
    // #7823 need to double-escape in SSR because the attributes are rendered
    // into an HTML string
    return `${id}-${getEscapedCssVarName(raw, isSSR)}`
  }
}

function normalizeExpression(exp: string) {
  exp = exp.trim()
  if (
    (exp[0] === `'` && exp[exp.length - 1] === `'`) ||
    (exp[0] === `"` && exp[exp.length - 1] === `"`)
  ) {
    return exp.slice(1, -1)
  }
  return exp
}

const vBindRE = /v-bind\s*\(/g

export function parseCssVars(sfc: SFCDescriptor): string[] {
  const vars: string[] = []
  sfc.styles.forEach(style => {
    let match
    const content = stripComments(style.content)
    while ((match = vBindRE.exec(content))) {
      const start = match.index + match[0].length
      const end = lexBinding(content, start)
      if (end !== null) {
        const variable = normalizeExpression(content.slice(start, end))
        if (!vars.includes(variable)) {
          vars.push(variable)
        }
      }
    }
  })
  return vars
}

enum CSSCharCodes {
  Tab = 0x9,
  NewLine = 0xa,
  FormFeed = 0xc,
  CarriageReturn = 0xd,
  Space = 0x20,
  DoubleQuote = 0x22,
  SingleQuote = 0x27,
  LeftParen = 0x28,
  RightParen = 0x29,
  Asterisk = 0x2a,
  Dash = 0x2d,
  Slash = 0x2f,
  Zero = 0x30,
  Nine = 0x39,
  UpperA = 0x41,
  UpperZ = 0x5a,
  Backslash = 0x5c,
  Underscore = 0x5f,
  LowerA = 0x61,
  LowerL = 0x6c,
  LowerR = 0x72,
  LowerU = 0x75,
  LowerZ = 0x7a,
}

// chars that can start a comment, a string, an escape or close `url(`
const cssSpecialRE = /[/"'\\(]/g

// Removes block comments and `//` comments (Less, Sass and Stylus all support
// `//`) so v-bind() inside them is ignored. Strings and unquoted url() are
// kept verbatim since they may legitimately contain comment delimiters.
function stripComments(content: string): string {
  const len = content.length
  let out = ''
  let last = 0
  let i = 0
  cssSpecialRE.lastIndex = 0
  while (cssSpecialRE.test(content)) {
    i = cssSpecialRE.lastIndex - 1
    const c = content.charCodeAt(i)
    if (c === CSSCharCodes.Slash) {
      const next = content.charCodeAt(i + 1)
      if (next === CSSCharCodes.Asterisk) {
        out += content.slice(last, i)
        const end = content.indexOf('*/', i + 2)
        i = last = end === -1 ? len : end + 2
      } else if (next === CSSCharCodes.Slash) {
        out += content.slice(last, i)
        i += 2
        while (i < len && !isNewline(content.charCodeAt(i))) i++
        last = i
      } else {
        i++
      }
    } else if (
      c === CSSCharCodes.DoubleQuote ||
      c === CSSCharCodes.SingleQuote
    ) {
      i = skipString(content, i + 1, c)
    } else if (c === CSSCharCodes.Backslash) {
      i += 2
    } else if (isUrlFunction(content, i)) {
      i = skipUrl(content, i + 1)
    } else {
      i++
    }
    cssSpecialRE.lastIndex = i
  }
  return last === 0 ? content : out + content.slice(last)
}

// an unterminated string ends at the newline, matching CSS bad-string;
// an escaped newline (including CRLF) is a continuation
function skipString(s: string, i: number, quote: number): number {
  while (i < s.length) {
    const c = s.charCodeAt(i)
    if (c === quote) return i + 1
    if (isNewline(c)) return i
    if (c === CSSCharCodes.Backslash) {
      i +=
        s.charCodeAt(i + 1) === CSSCharCodes.CarriageReturn &&
        s.charCodeAt(i + 2) === CSSCharCodes.NewLine
          ? 3
          : 2
    } else {
      i++
    }
  }
  return i
}

// i is at `(`; `url` must be a whole identifier so that e.g. `my-url(` and
// `my\url(` are not mistaken for url()
function isUrlFunction(s: string, i: number): boolean {
  const prev = s.charCodeAt(i - 4)
  return (
    (s.charCodeAt(i - 3) | 0x20) === CSSCharCodes.LowerU &&
    (s.charCodeAt(i - 2) | 0x20) === CSSCharCodes.LowerR &&
    (s.charCodeAt(i - 1) | 0x20) === CSSCharCodes.LowerL &&
    prev !== CSSCharCodes.Backslash &&
    !isIdentChar(prev)
  )
}

// i is right after `url(`; a quoted url is left to the string scanner
function skipUrl(s: string, i: number): number {
  while (isWhitespace(s.charCodeAt(i))) i++
  const c = s.charCodeAt(i)
  if (c === CSSCharCodes.DoubleQuote || c === CSSCharCodes.SingleQuote) return i
  while (i < s.length) {
    const c = s.charCodeAt(i)
    if (c === CSSCharCodes.RightParen) return i + 1
    i += c === CSSCharCodes.Backslash ? 2 : 1
  }
  return i
}

function isIdentChar(c: number): boolean {
  return (
    (c >= CSSCharCodes.LowerA && c <= CSSCharCodes.LowerZ) ||
    (c >= CSSCharCodes.UpperA && c <= CSSCharCodes.UpperZ) ||
    (c >= CSSCharCodes.Zero && c <= CSSCharCodes.Nine) ||
    c === CSSCharCodes.Dash ||
    c === CSSCharCodes.Underscore ||
    c >= 0x80
  )
}

function isNewline(c: number): boolean {
  return c === CSSCharCodes.NewLine || c === CSSCharCodes.CarriageReturn
}

function isWhitespace(c: number): boolean {
  return (
    c === CSSCharCodes.Space ||
    c === CSSCharCodes.Tab ||
    c === CSSCharCodes.FormFeed ||
    isNewline(c)
  )
}

enum LexerState {
  inParens,
  inSingleQuoteString,
  inDoubleQuoteString,
}

function lexBinding(content: string, start: number): number | null {
  let state: LexerState = LexerState.inParens
  let parenDepth = 0

  for (let i = start; i < content.length; i++) {
    const char = content.charAt(i)
    switch (state) {
      case LexerState.inParens:
        if (char === `'`) {
          state = LexerState.inSingleQuoteString
        } else if (char === `"`) {
          state = LexerState.inDoubleQuoteString
        } else if (char === `(`) {
          parenDepth++
        } else if (char === `)`) {
          if (parenDepth > 0) {
            parenDepth--
          } else {
            return i
          }
        }
        break
      case LexerState.inSingleQuoteString:
        if (char === `'`) {
          state = LexerState.inParens
        }
        break
      case LexerState.inDoubleQuoteString:
        if (char === `"`) {
          state = LexerState.inParens
        }
        break
    }
  }
  return null
}

// for compileStyle
export interface CssVarsPluginOptions {
  id: string
  isProd: boolean
}

export const cssVarsPlugin: PluginCreator<CssVarsPluginOptions> = opts => {
  const { id, isProd } = opts!
  return {
    postcssPlugin: 'vue-sfc-vars',
    Declaration(decl) {
      // rewrite CSS variables
      const value = decl.value
      if (vBindRE.test(value)) {
        vBindRE.lastIndex = 0
        let transformed = ''
        let lastIndex = 0
        let match
        while ((match = vBindRE.exec(value))) {
          const start = match.index + match[0].length
          const end = lexBinding(value, start)
          if (end !== null) {
            const variable = normalizeExpression(value.slice(start, end))
            transformed +=
              value.slice(lastIndex, match.index) +
              `var(--${genVarName(id, variable, isProd)})`
            lastIndex = end + 1
          }
        }
        decl.value = transformed + value.slice(lastIndex)
      }
    },
  }
}
cssVarsPlugin.postcss = true

export function genCssVarsCode(
  vars: string[],
  bindings: BindingMetadata,
  id: string,
  isProd: boolean,
  vapor?: boolean,
) {
  const varsExp = genCssVarsFromList(vars, id, isProd)
  const exp = createSimpleExpression(varsExp, false)
  const context = createTransformContext(createRoot([]), {
    prefixIdentifiers: true,
    inline: true,
    bindingMetadata: bindings.__isScriptSetup === false ? undefined : bindings,
  })
  const transformed = processExpression(exp, context)
  const transformedString =
    transformed.type === NodeTypes.SIMPLE_EXPRESSION
      ? transformed.content
      : transformed.children
          .map(c => {
            return typeof c === 'string'
              ? c
              : (c as SimpleExpressionNode).content
          })
          .join('')

  return `_${getCssVarsHelper(vapor)}(_ctx => (${transformedString}))`
}

// <script setup> already gets the calls injected as part of the transform
// this is only for single normal <script>
export function genNormalScriptCssVarsCode(
  cssVars: string[],
  bindings: BindingMetadata,
  id: string,
  isProd: boolean,
  defaultVar: string,
): string {
  return (
    `\nimport { ${CSS_VARS_HELPER} as _${CSS_VARS_HELPER} } from 'vue'\n` +
    `const __injectCSSVars__ = () => {\n${genCssVarsCode(cssVars, bindings, id, isProd)}}\n` +
    `const __setup__ = ${defaultVar}.setup\n` +
    `${defaultVar}.setup = __setup__\n` +
    `  ? (props, ctx) => { __injectCSSVars__();return __setup__(props, ctx) }\n` +
    `  : __injectCSSVars__\n`
  )
}
