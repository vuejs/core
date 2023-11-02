import { shouldTransform, transformAST } from '@vue/reactivity-transform'
import { analyzeScriptBindings } from './analyzeScriptBindings'
import { ScriptCompileContext } from './context'
import MagicString from 'magic-string'
import { RawSourceMap } from 'source-map-js'
import { rewriteDefaultAST } from '../rewriteDefault'
import { CSS_VARS_HELPER, genCssVarsCode } from '../style/cssVars'
import { CE_STYLE_ATTRS_HELPER, genCEStyleAttrs } from "../style/ceStyleAttrs";

export const normalScriptDefaultVar = `__default__`

export function processNormalScript(
  ctx: ScriptCompileContext,
  scopeId: string
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
    const { source, filename, cssVars, ceStyleAttrs } = ctx.descriptor
    const { sourceMap, genDefaultAs, isProd } = ctx.options

    // TODO remove in 3.4
    if (ctx.options.reactivityTransform && shouldTransform(content)) {
      const s = new MagicString(source)
      const startOffset = script.loc.start.offset
      const endOffset = script.loc.end.offset
      const { importedHelpers } = transformAST(scriptAst, s, startOffset)
      if (importedHelpers.length) {
        s.prepend(
          `import { ${importedHelpers
            .map(h => `${h} as _${h}`)
            .join(', ')} } from 'vue'\n`
        )
      }
      s.remove(0, startOffset)
      s.remove(endOffset, source.length)
      content = s.toString()
      if (sourceMap !== false) {
        map = s.generateMap({
          source: filename,
          hires: true,
          includeContent: true
        }) as unknown as RawSourceMap
      }
    }

    if (cssVars.length || ceStyleAttrs.length ||genDefaultAs) {
      const defaultVar = genDefaultAs || normalScriptDefaultVar
      const s = new MagicString(content)
      rewriteDefaultAST(scriptAst.body, s, defaultVar)
      content = s.toString()
      let injectCode = ''
      let injectImporter = []
      if (cssVars.length && !ctx.options.templateOptions?.ssr) {
        injectCode += genCssVarsCode(
          cssVars,
          bindings,
          scopeId,
          !!isProd,
        ) + '\n'
        injectImporter.push(CSS_VARS_HELPER)
      }

      if (ceStyleAttrs.length && !ctx.options.templateOptions?.ssr) {
        injectCode += genCEStyleAttrs(
          ceStyleAttrs,
          bindings,
        )
        injectImporter.push(CE_STYLE_ATTRS_HELPER)
      }

      if(injectCode){
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
      scriptAst: scriptAst.body
    }
  } catch (e: any) {
    // silently fallback if parse fails since user may be using custom
    // babel syntax
    return script
  }
}

// <script setup> already gets the calls injected as part of the transform
// this is only for single normal <script>
function genInjectCode(content: string, defaultVar: string, importer: string[]){
  const importerContent = importer.map(v => ` ${v} as _${v} `).join(',')
  return (
    `\nimport { ${importerContent} } from 'vue'\n` +
    `const __injectCSSVars__ = () => {\n${content}}\n` +
    `const __setup__ = ${defaultVar}.setup\n` +
    `${defaultVar}.setup = __setup__\n` +
    `  ? (props, ctx) => { __injectCSSVars__();return __setup__(props, ctx) }\n` +
    `  : __injectCSSVars__\n`
  )
}
