import type { CodegenContext } from '../generate'
import type { CreateTextNodeIRNode, SetTextIRNode } from '../ir'
import { genExpression } from './expression'
import {
  type CodeFragment,
  DELIMITERS_ARRAY,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'

export function genSetText(
  oper: SetTextIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  const { element, values } = oper
  return [
    NEWLINE,
    ...genCall(
      vaporHelper('setText'),
      `n${element}`,
      ...values.map(value => genExpression(value, context)),
    ),
  ]
}

export function genCreateTextNode(
  oper: CreateTextNodeIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  const { id, values, effect } = oper
  return [
    NEWLINE,
    `const n${id} = `,
    ...genCall(vaporHelper('createTextNode'), [
      effect && '() => ',
      ...genMulti(
        DELIMITERS_ARRAY,
        ...values.map(value => genExpression(value, context)),
      ),
    ]),
  ]
}
