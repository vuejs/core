import type { CodeFragment, CodegenContext } from '../generate'
import type { CreateTextNodeIRNode, SetTextIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetText(
  oper: SetTextIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, newline, vaporHelper } = context
  return [
    newline(),
    ...call(
      vaporHelper('setText'),
      `n${oper.element}`,
      genExpression(oper.value, context),
    ),
  ]
}

export function genCreateTextNode(
  oper: CreateTextNodeIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { newline, call, vaporHelper } = context
  return [
    newline(),
    `const n${oper.id} = `,
    ...call(vaporHelper('createTextNode')),
  ]
}
