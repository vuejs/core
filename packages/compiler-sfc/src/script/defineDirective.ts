import type { ScriptCompileContext } from './context'
import type { LVal, Node } from '@babel/types'
import { isCallOf } from './utils'
import { unwrapTSNode } from '@vue/compiler-dom'

export const DEFINE_DIRECTIVE = 'defineDirective'

export function processDefineDirective(
  ctx: ScriptCompileContext,
  node: Node,
  declId?: LVal,
) {
  if (!isCallOf(node, DEFINE_DIRECTIVE)) {
    return false
  }
  let options: Node | undefined
  const arg0 = node.arguments[0] && unwrapTSNode(node.arguments[0])
  options = arg0

  let optionsString = options && ctx.getString(options)

  ctx.s.overwrite(
    ctx.startOffset! + node.start!,
    ctx.startOffset! + node.end!,
    optionsString,
  )

  return true
}
