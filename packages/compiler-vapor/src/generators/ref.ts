import type { CodegenContext } from '../generate'
import type { SetRefIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetRef(oper: SetRefIRNode, context: CodegenContext) {
  const { newline, pushCall, vaporHelper } = context
  newline()
  pushCall(vaporHelper('setRef'), `n${oper.element}`, () =>
    genExpression(oper.value, context),
  )
}
