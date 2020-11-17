import {
  processExpression,
  createTransformContext,
  createSimpleExpression,
  createRoot,
  NodeTypes,
  SimpleExpressionNode,
  BindingMetadata
} from '@vue/compiler-dom'
import { SFCDescriptor } from './parse'
import { rewriteDefault } from './rewriteDefault'
import { ParserPlugin } from '@babel/parser'
import postcss, { Root } from 'postcss'
import hash from 'hash-sum'

export const CSS_VARS_HELPER = `useCssVars`
export const cssVarRE = /\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([^'"][^)]*))\s*\)/g

/**
 * Given an SFC descriptor, generate the CSS variables object string that can be
 * passed to `compileTemplate` as `compilerOptions.ssrCssVars`.
 * @public
 */
export function generateCssVars(
  sfc: SFCDescriptor,
  id: string,
  isProd: boolean
): string {
  return genCssVarsFromList(parseCssVars(sfc), id, isProd)
}

function genCssVarsFromList(
  vars: string[],
  id: string,
  isProd: boolean
): string {
  return `{\n  ${vars
    .map(v => `"${genVarName(id, v, isProd)}": (${v})`)
    .join(',\n  ')}\n}`
}

function genVarName(id: string, raw: string, isProd: boolean): string {
  if (isProd) {
    return hash(id + raw)
  } else {
    return `${id}-${raw.replace(/([^\w-])/g, '_')}`
  }
}

export function parseCssVars(sfc: SFCDescriptor): string[] {
  const vars: string[] = []
  sfc.styles.forEach(style => {
    let match
    while ((match = cssVarRE.exec(style.content))) {
      vars.push(match[1] || match[2] || match[3])
    }
  })
  return vars
}

// for compileStyle
export interface CssVarsPluginOptions {
  id: string
  isProd: boolean
}

export const cssVarsPlugin = postcss.plugin<CssVarsPluginOptions>(
  'vue-scoped',
  opts => (root: Root) => {
    const { id, isProd } = opts!
    const shortId = id.replace(/^data-v-/, '')
    root.walkDecls(decl => {
      // rewrite CSS variables
      if (cssVarRE.test(decl.value)) {
        decl.value = decl.value.replace(cssVarRE, (_, $1, $2, $3) => {
          return `var(--${genVarName(shortId, $1 || $2 || $3, isProd)})`
        })
      }
    })
  }
)

export function genCssVarsCode(
  vars: string[],
  bindings: BindingMetadata,
  id: string,
  isProd: boolean
) {
  const varsExp = genCssVarsFromList(vars, id, isProd)
  const exp = createSimpleExpression(varsExp, false)
  const context = createTransformContext(createRoot([]), {
    prefixIdentifiers: true,
    inline: true,
    bindingMetadata: bindings
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
export function injectCssVarsCalls(
  sfc: SFCDescriptor,
  cssVars: string[],
  bindings: BindingMetadata,
  id: string,
  isProd: boolean,
  parserPlugins: ParserPlugin[]
): string {
  const script = rewriteDefault(
    sfc.script!.content,
    `__default__`,
    parserPlugins
  )

  return (
    script +
    `\nimport { ${CSS_VARS_HELPER} as _${CSS_VARS_HELPER} } from 'vue'\n` +
    `const __injectCSSVars__ = () => {\n${genCssVarsCode(
      cssVars,
      bindings,
      id,
      isProd
    )}}\n` +
    `const __setup__ = __default__.setup\n` +
    `__default__.setup = __setup__\n` +
    `  ? (props, ctx) => { __injectCSSVars__();return __setup__(props, ctx) }\n` +
    `  : __injectCSSVars__\n` +
    `export default __default__`
  )
}
