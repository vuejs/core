import type { CodegenContext } from '../generate'
import type { SetHtmlIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetHtml(oper: SetHtmlIRNode, context: CodegenContext) {
  const { newline, pushCall, vaporHelper } = context
  newline()
  pushCall(vaporHelper('setHtml'), `n${oper.element}`, () =>
    genExpression(oper.value, context),
  )
}
