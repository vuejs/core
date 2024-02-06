import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'
import type { CreateTextNodeIRNode, SetTextIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetText(
  oper: SetTextIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, multi, vaporHelper } = context
  const { values } = oper
  return [
    NEWLINE,
    ...call(
      vaporHelper('setText'),
      `n${oper.element}`,
      multi(
        ['', '', ' + '],
        ...values.map((value, idx) => [
          idx === 0 &&
          values.length > 1 &&
          !value.isStatic &&
          !values[1].isStatic
            ? '"" + '
            : '',
          ...genExpression(value, context),
        ]),
      ),
    ),
  ]
}

export function genCreateTextNode(
  oper: CreateTextNodeIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, vaporHelper } = context
  return [
    NEWLINE,
    `const n${oper.id} = `,
    ...call(vaporHelper('createTextNode')),
  ]
}
