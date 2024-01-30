import type { CodegenContext } from '../generate'
import type { CreateTextNodeIRNode, SetTextIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetText(oper: SetTextIRNode, context: CodegenContext) {
  const { pushCall, newline, vaporHelper } = context
  newline()
  pushCall(vaporHelper('setText'), `n${oper.element}`, () =>
    genExpression(oper.value, context),
  )
}

export function genCreateTextNode(
  oper: CreateTextNodeIRNode,
  context: CodegenContext,
) {
  const { newline, pushCall, vaporHelper } = context
  newline(`const n${oper.id} = `)
  pushCall(vaporHelper('createTextNode'), () =>
    genExpression(oper.value, context),
  )
}
