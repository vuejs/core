import type { CodegenContext } from '../generate'
import type { SetHtmlIRNode } from '../ir'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, genCall } from './utils'
import { processValues } from './prop'

export function genSetHtml(
  oper: SetHtmlIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper, shouldCacheRenderEffectDeps } = context
  const { value, element } = oper
  let html = genExpression(value, context)
  if (shouldCacheRenderEffectDeps()) {
    processValues(context, [html])
  }
  return [NEWLINE, ...genCall(vaporHelper('setHtml'), `n${element}`, html)]
}
