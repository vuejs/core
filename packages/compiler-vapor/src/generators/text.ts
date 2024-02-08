import type { CodegenContext } from '../generate'
import type { CreateTextNodeIRNode, SetTextIRNode } from '../ir'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genSetText(
  oper: SetTextIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  const { values } = oper
  return [
    NEWLINE,
    ...genCall(
      vaporHelper('setText'),
      `n${oper.element}`,
      ...values.map(value => genExpression(value, context)),
    ),
  ]
}

export function genCreateTextNode(
  oper: CreateTextNodeIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  return [
    NEWLINE,
    `const n${oper.id} = `,
    ...genCall(vaporHelper('createTextNode')),
  ]
}
