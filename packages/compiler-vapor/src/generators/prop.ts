import type { CodegenContext } from '../generate'
import type { SetPropIRNode } from '../ir'
import { genExpression } from './expression'

export function genSetProp(oper: SetPropIRNode, context: CodegenContext) {
  const { pushFnCall, pushMulti, newline, vaporHelper, helper } = context

  newline()
  pushFnCall(
    vaporHelper('setDynamicProp'),
    `n${oper.element}`,
    // 2. key name
    () => {
      if (oper.runtimeCamelize) {
        pushFnCall(helper('camelize'), () => genExpression(oper.key, context))
      } else if (oper.runtimePrefix) {
        pushMulti([`\`${oper.runtimePrefix}\${`, `}\``], () =>
          genExpression(oper.key, context),
        )
      } else {
        genExpression(oper.key, context)
      }
    },
    'undefined',
    () => genExpression(oper.value, context),
  )
}
