import type { CodegenContext } from '../generate'
import type { SetPropIRNode } from '../ir'
import { genExpression } from './expression'
import { isString } from '@vue/shared'

export function genSetProp(oper: SetPropIRNode, context: CodegenContext) {
  const { pushCall, pushMulti, newline, vaporHelper, helper } = context

  newline()

  const element = `n${oper.element}`

  // fast path for static props
  if (isString(oper.key) || oper.key.isStatic) {
    const keyName = isString(oper.key) ? oper.key : oper.key.content

    let helperName: string | undefined
    let omitKey = false
    if (keyName === 'class') {
      helperName = 'setClass'
      omitKey = true
    } else if (keyName === 'style') {
      helperName = 'setStyle'
      omitKey = true
    } else if (oper.modifier) {
      helperName = oper.modifier === '.' ? 'setDOMProp' : 'setAttr'
    }

    if (helperName) {
      pushCall(
        vaporHelper(helperName),
        element,
        omitKey
          ? false
          : () => {
              const expr = () => genExpression(oper.key, context)
              if (oper.runtimeCamelize) {
                pushCall(helper('camelize'), expr)
              } else {
                expr()
              }
            },
        () => genExpression(oper.value, context),
      )
      return
    }
  }

  pushCall(
    vaporHelper('setDynamicProp'),
    element,
    // 2. key name
    () => {
      if (oper.runtimeCamelize) {
        pushCall(helper('camelize'), () => genExpression(oper.key, context))
      } else if (oper.modifier) {
        pushMulti([`\`${oper.modifier}\${`, `}\``], () =>
          genExpression(oper.key, context),
        )
      } else {
        genExpression(oper.key, context)
      }
    },
    () => genExpression(oper.value, context),
  )
}
