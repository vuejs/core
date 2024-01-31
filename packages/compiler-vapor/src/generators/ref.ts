import { genExpression } from './expression'
import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'
import type { SetRefIRNode } from '../ir'

export function genSetRef(
  oper: SetRefIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, vaporHelper } = context
  return [
    NEWLINE,
    ...call(
      vaporHelper('setRef'),
      [`n${oper.element}`],
      genExpression(oper.value, context),
    ),
  ]
}
