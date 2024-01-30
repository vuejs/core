import type { CodeFragment, CodegenContext } from '../generate'
import type { SetHtmlIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetHtml(
  oper: SetHtmlIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { newline, call, vaporHelper } = context
  return [
    newline(),
    ...call(
      vaporHelper('setHtml'),
      `n${oper.element}`,
      genExpression(oper.value, context),
    ),
  ]
}
