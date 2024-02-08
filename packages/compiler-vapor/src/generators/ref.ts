import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { SetRefIRNode } from '../ir'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genSetRef(
  oper: SetRefIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  return [
    NEWLINE,
    ...genCall(
      vaporHelper('setRef'),
      [`n${oper.element}`],
      genExpression(oper.value, context),
    ),
  ]
}
