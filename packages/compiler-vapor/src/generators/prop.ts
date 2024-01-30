import type { CodeFragment, CodegenContext } from '../generate'
import type { SetPropIRNode, VaporHelper } from '../ir'
import { genExpression } from './expression'
import { isString } from '@vue/shared'

export function genSetProp(
  oper: SetPropIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, newline, vaporHelper, helper } = context

  const element = `n${oper.element}`
  const expr = genExpression(oper.key, context)

  // fast path for static props
  if (isString(oper.key) || oper.key.isStatic) {
    const keyName = isString(oper.key) ? oper.key : oper.key.content

    let helperName: VaporHelper | undefined
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
      return [
        newline(),
        ...call(
          vaporHelper(helperName),
          element,
          omitKey ? false : expr,
          genExpression(oper.value, context),
        ),
      ]
    }
  }

  return [
    newline(),
    ...call(
      vaporHelper('setDynamicProp'),
      element,
      genDynamicKey(),
      genExpression(oper.value, context),
    ),
  ]

  function genDynamicKey(): CodeFragment[] {
    if (oper.runtimeCamelize) {
      return call(helper('camelize'), expr)
    } else if (oper.modifier) {
      return [`\`${oper.modifier}\${`, ...expr, `}\``]
    } else {
      return expr
    }
  }
}
