import { shouldTransform, transformAST } from '@vue/reactivity-transform'
import { analyzeScriptBindings } from './analyzeScriptBindings'
import { ScriptCompileContext } from './context'
import MagicString from 'magic-string'
import { RawSourceMap } from 'source-map-js'
import { rewriteDefaultAST } from '../rewriteDefault'
import { genNormalScriptCssVarsCode } from '../style/cssVars'

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
    const { source, filename, cssVars } = ctx.descriptor
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

    if (cssVars.length || genDefaultAs) {
      const defaultVar = genDefaultAs || normalScriptDefaultVar
      const s = new MagicString(content)
      rewriteDefaultAST(scriptAst.body, s, defaultVar)
      content = s.toString()
      if (cssVars.length) {
        content += genNormalScriptCssVarsCode(
          cssVars,
          bindings,
          scopeId,
          !!isProd,
          defaultVar
        )
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
