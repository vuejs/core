import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'
import type { SetPropIRNode, VaporHelper } from '../ir'
import { genExpression } from './expression'
import { isString } from '@vue/shared'

export function genSetProp(
  oper: SetPropIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, vaporHelper, helper } = context

  const element = `n${oper.element}`
  const key = genExpression(oper.key, context)
  const value = genExpression(oper.value, context)

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
        NEWLINE,
        ...call(vaporHelper(helperName), element, omitKey ? false : key, value),
      ]
    }
  }

  return [
    NEWLINE,
    ...call(vaporHelper('setDynamicProp'), element, genDynamicKey(), value),
  ]

  function genDynamicKey(): CodeFragment[] {
    if (oper.runtimeCamelize) {
      return call(helper('camelize'), key)
    } else if (oper.modifier) {
      return [`\`${oper.modifier}\${`, ...key, `}\``]
    } else {
      return key
    }
  }
}
