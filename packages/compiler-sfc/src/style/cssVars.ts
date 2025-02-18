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

export function genCssVarsFromList(
  vars: string[],
  id: string,
  isProd: boolean,
  isSSR = false,
): string {
  return `{\n  ${vars
    .map(
      key =>
        `"${isSSR ? `--` : ``}${genVarName(id, key, isProd, isSSR)}": (${key})`,
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
    return hash(id + raw)
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
    // ignore v-bind() in comments, eg /* ... */
    // and // (Less, Sass and Stylus all support the use of // to comment)
    const content = style.content.replace(/\/\*([\s\S]*?)\*\/|\/\/.*/g, '')
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

  return `_${CSS_VARS_HELPER}(_ctx => (${transformedString}))`
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
    `const __injectCSSVars__ = () => {\n${genCssVarsCode(
      cssVars,
      bindings,
      id,
      isProd,
    )}}\n` +
    `const __setup__ = ${defaultVar}.setup\n` +
    `${defaultVar}.setup = __setup__\n` +
    `  ? (props, ctx) => { __injectCSSVars__();return __setup__(props, ctx) }\n` +
    `  : __injectCSSVars__\n`
  )
}
