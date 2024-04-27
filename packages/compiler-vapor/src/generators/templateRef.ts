import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { SetTemplateRefIRNode } from '../ir'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genSetTemplateRef(
  oper: SetTemplateRefIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  return [
    NEWLINE,
    ...genCall(
      vaporHelper('setRef'),
      `n${oper.element}`,
      genExpression(oper.value, context),
      oper.refFor && 'true',
    ),
  ]
}
