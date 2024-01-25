import type { CodegenContext } from '../generate'
import type { SetHtmlIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetHtml(oper: SetHtmlIRNode, context: CodegenContext) {
  const { newline, pushFnCall, vaporHelper } = context
  newline()
  pushFnCall(vaporHelper('setHtml'), `n${oper.element}`, () =>
    genExpression(oper.value, context),
  )
}
