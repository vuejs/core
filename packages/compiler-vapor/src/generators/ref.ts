import type { CodegenContext } from '../generate'
import type { SetRefIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetRef(oper: SetRefIRNode, context: CodegenContext) {
  const { newline, pushFnCall, vaporHelper } = context
  newline()
  pushFnCall(vaporHelper('setRef'), `n${oper.element}`, () =>
    genExpression(oper.value, context),
  )
}
