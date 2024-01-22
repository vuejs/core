import type { CodegenContext } from '../generate'
import type { SetPropIRNode } from '../ir'
import { genExpression } from './expression'
import { isString } from '@vue/shared'

export function genSetProp(oper: SetPropIRNode, context: CodegenContext) {
  const { pushFnCall, pushMulti, newline, vaporHelper, helper } = context

  newline()

  const element = `n${oper.element}`

  // fast path for static props
  if (isString(oper.key) || oper.key.isStatic) {
    const keyName = isString(oper.key) ? oper.key : oper.key.content

    let helperName: string | undefined
    if (keyName === 'class') {
      helperName = 'setClass'
    } else if (keyName === 'style') {
      helperName = 'setStyle'
    } else if (oper.modifier) {
      helperName = oper.modifier === '.' ? 'setDOMProp' : 'setAttr'
    }

    if (helperName) {
      pushFnCall(
        vaporHelper(helperName),
        element,
        () => {
          const expr = () => genExpression(oper.key, context)
          if (oper.runtimeCamelize) {
            pushFnCall(helper('camelize'), expr)
          } else {
            expr()
          }
        },
        'undefined',
        () => genExpression(oper.value, context),
      )
      return
    }
  }

  pushFnCall(
    vaporHelper('setDynamicProp'),
    element,
    // 2. key name
    () => {
      if (oper.runtimeCamelize) {
        pushFnCall(helper('camelize'), () => genExpression(oper.key, context))
      } else if (oper.modifier) {
        pushMulti([`\`${oper.modifier}\${`, `}\``], () =>
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
