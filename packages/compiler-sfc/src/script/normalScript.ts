import { analyzeScriptBindings } from './analyzeScriptBindings'
import type { ScriptCompileContext } from './context'
import MagicString from 'magic-string'
import { rewriteDefaultAST } from '../rewriteDefault'
import { CSS_VARS_HELPER, genCssVarsCode } from '../style/cssVars'
import { CE_STYLE_ATTRS_HELPER, genCEStyleAttrs } from '../style/ceStyleAttrs'

export const normalScriptDefaultVar = `__default__`

export function processNormalScript(
  ctx: ScriptCompileContext,
  scopeId: string,
) {
  const script = ctx.descriptor.script!
  if (script.lang && !ctx.isJS && !ctx.isTS) {
    // do not process non js/ts script blocks
    return script
  }
  try {
    let content = script.content
    let map = script.map
    const scriptAst = ctx.scriptAst!
    const bindings = analyzeScriptBindings(scriptAst.body)
    const { cssVars, ceStyleAttrs } = ctx.descriptor
    const { genDefaultAs, isProd } = ctx.options

    if (cssVars.length || ceStyleAttrs.length || genDefaultAs) {
      const defaultVar = genDefaultAs || normalScriptDefaultVar
      const s = new MagicString(content)
      rewriteDefaultAST(scriptAst.body, s, defaultVar)
      content = s.toString()
      let injectCode = ''
      let injectImporter = []
      if (cssVars.length && !ctx.options.templateOptions?.ssr) {
        injectCode += genCssVarsCode(cssVars, bindings, scopeId, !!isProd)
        injectImporter.push(CSS_VARS_HELPER)
      }

      if (ceStyleAttrs.length && !ctx.options.templateOptions?.ssr) {
        injectCode += '\n' + genCEStyleAttrs(ceStyleAttrs, bindings)
        injectImporter.push(CE_STYLE_ATTRS_HELPER)
      }

      if (injectCode) {
        content += genInjectCode(injectCode, defaultVar, injectImporter)
      }

      if (!genDefaultAs) {
        content += `\nexport default ${defaultVar}`
      }
    }
    return {
      ...script,
      content,
      map,
      bindings,
      scriptAst: scriptAst.body,
    }
  } catch (e: any) {
    // silently fallback if parse fails since user may be using custom
    // babel syntax
    return script
  }
}

// <script setup> already gets the calls injected as part of the transform
// this is only for single normal <script>
function genInjectCode(
  content: string,
  defaultVar: string,
  importer: string[]
) {
  const importerContent = importer.map(v => ` ${v} as _${v} `).join(',')
  return (
    `\nimport {${importerContent}} from 'vue'\n` +
    `const __injectCSSVars__ = () => {\n${content}}\n` +
    `const __setup__ = ${defaultVar}.setup\n` +
    `${defaultVar}.setup = __setup__\n` +
    `  ? (props, ctx) => { __injectCSSVars__();return __setup__(props, ctx) }\n` +
    `  : __injectCSSVars__\n`
  )
}
