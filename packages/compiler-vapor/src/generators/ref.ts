import { genExpression } from './expression'
import type { CodeFragment, CodegenContext } from '../generate'
import type { SetRefIRNode } from '../ir'

export function genSetRef(
  oper: SetRefIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { newline, call, vaporHelper } = context
  return [
    newline(),
    ...call(
      vaporHelper('setRef'),
      [`n${oper.element}`],
      genExpression(oper.value, context),
    ),
  ]
}
