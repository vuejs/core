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
  const { helper } = context
  const { element, values } = oper
  const texts = values.map(value => genExpression(value, context))
  return [NEWLINE, ...genCall(helper('setText'), `n${element}`, ...texts)]
}

export function genCreateTextNode(
  oper: CreateTextNodeIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const { id, values, effect } = oper
  return [
    NEWLINE,
    `const n${id} = `,
    ...genCall(helper('createTextNode'), [
      effect && '() => ',
      ...genMulti(
        DELIMITERS_ARRAY,
        ...values.map(value => genExpression(value, context)),
      ),
    ]),
  ]
}
