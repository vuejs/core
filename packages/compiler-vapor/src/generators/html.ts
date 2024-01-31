import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'
import type { SetHtmlIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetHtml(
  oper: SetHtmlIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, vaporHelper } = context
  return [
    NEWLINE,
    ...call(
      vaporHelper('setHtml'),
      `n${oper.element}`,
      genExpression(oper.value, context),
    ),
  ]
}
