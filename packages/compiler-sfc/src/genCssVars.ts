import {
  processExpression,
  createTransformContext,
  createSimpleExpression,
  createRoot,
  NodeTypes,
  SimpleExpressionNode
} from '@vue/compiler-dom'
import { SFCDescriptor } from './parse'
import { rewriteDefault } from './rewriteDefault'
import { ParserPlugin } from '@babel/parser'

export function genCssVarsCode(
  varsExp: string,
  scoped: boolean,
  knownBindings?: Record<string, any>
) {
  const exp = createSimpleExpression(varsExp, false)
  const context = createTransformContext(createRoot([]), {
    prefixIdentifiers: true
  })
  if (knownBindings) {
    // when compiling <script setup> we already know what bindings are exposed
    // so we can avoid prefixing them from the ctx.
    for (const key in knownBindings) {
      context.identifiers[key] = 1
    }
  }
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

  return `__useCssVars__(_ctx => (${transformedString})${
    scoped ? `, true` : ``
  })`
}

// <script setup> already gets the calls injected as part of the transform
// this is only for single normal <script>
export function injectCssVarsCalls(
  sfc: SFCDescriptor,
  parserPlugins: ParserPlugin[]
): string {
  const script = rewriteDefault(
    sfc.script!.content,
    `__default__`,
    parserPlugins
  )

  let calls = ``
  for (const style of sfc.styles) {
    const vars = style.attrs.vars
    if (typeof vars === 'string') {
      calls += genCssVarsCode(vars, !!style.scoped) + '\n'
    }
  }

  return (
    script +
    `\nimport { useCssVars as __useCssVars__ } from 'vue'\n` +
    `const __injectCSSVars__ = () => {\n${calls}}\n` +
    `const __setup__ = __default__.setup\n` +
    `__default__.setup = __setup__\n` +
    `  ? (props, ctx) => { __injectCSSVars__();return __setup__(props, ctx) }\n` +
    `  : __injectCSSVars__\n` +
    `export default __default__`
  )
}
