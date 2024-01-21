import type { CodegenContext } from '../generate'
import type { CreateTextNodeIRNode, SetTextIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetText(oper: SetTextIRNode, context: CodegenContext) {
  const { pushFnCall, newline, vaporHelper } = context
  newline()
  pushFnCall(vaporHelper('setText'), `n${oper.element}`, 'undefined', () =>
    genExpression(oper.value, context),
  )
}

export function genCreateTextNode(
  oper: CreateTextNodeIRNode,
  context: CodegenContext,
) {
  const { pushNewline, pushFnCall, vaporHelper } = context
  pushNewline(`const n${oper.id} = `)
  pushFnCall(vaporHelper('createTextNode'), () =>
    genExpression(oper.value, context),
  )
}
