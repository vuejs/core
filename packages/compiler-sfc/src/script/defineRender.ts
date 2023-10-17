import { Node } from '@babel/types'
import { isCallOf } from './utils'
import { ScriptCompileContext } from './context'
import { warnOnce } from '../warn'

export const DEFINE_RENDER = 'defineRender'

export function processDefineRender(
  ctx: ScriptCompileContext,
  node: Node
): boolean {
  if (!isCallOf(node, DEFINE_RENDER)) {
    return false
  }

  if (!ctx.options.defineRender) {
    warnOnce(
      `${DEFINE_RENDER}() is an experimental feature and disabled by default.\n` +
        `To enable it, follow the RFC at https://github.com/vuejs/rfcs/discussions/TODO.`
    )
    return false
  }

  if (ctx.hasDefineRenderCall) {
    ctx.error(`duplicate ${DEFINE_RENDER}() call`, node)
  }

  ctx.hasDefineRenderCall = true
  if (node.arguments.length > 0) {
    ctx.renderFunction = node.arguments[0]
  }

  return true
}
