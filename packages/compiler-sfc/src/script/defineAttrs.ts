import { LVal, Node } from '@babel/types'
import { isCallOf } from './utils'
import { ScriptCompileContext } from './context'

export const DEFINE_ATTRS = 'defineAttrs'

export function processDefineAttrs(
  ctx: ScriptCompileContext,
  node: Node,
  declId?: LVal
): boolean {
  if (!isCallOf(node, DEFINE_ATTRS)) {
    return false
  }
  if (ctx.hasDefineAttrsCall) {
    ctx.error(`duplicate ${DEFINE_ATTRS}() call`, node)
  }
  ctx.hasDefineAttrsCall = true

  if (node.arguments.length > 0) {
    ctx.error(`${DEFINE_ATTRS}() cannot accept arguments`, node)
  }

  if (declId) {
    ctx.s.overwrite(
      ctx.startOffset! + node.start!,
      ctx.startOffset! + node.end!,
      `${ctx.helper('useAttrs')}()`
    )
  }

  return true
}
