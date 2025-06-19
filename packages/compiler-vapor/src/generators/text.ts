import type { SimpleExpressionNode } from '@vue/compiler-dom'
import type { CodegenContext } from '../generate'
import type { GetTextChildIRNode, SetTextIRNode } from '../ir'
import { getLiteralExpressionValue } from '../utils'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genSetText(
  oper: SetTextIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const {
    helper,
    block: { dynamicComponents },
  } = context
  const { element, values, generated, jsx } = oper
  const texts = combineValues(values, context, jsx)

  // if the element is a dynamic component, we need to use `setElementText`
  // to set the textContent of the VaporFragment's nodes.
  return dynamicComponents.includes(oper.element)
    ? [
        NEWLINE,
        ...genCall(
          helper('setElementText'),
          `n${element}.nodes`,
          texts,
          'true', // isConverted
        ),
      ]
    : [
        NEWLINE,
        ...genCall(
          helper('setText'),
          `${generated ? 'x' : 'n'}${element}`,
          texts,
        ),
      ]
}

function combineValues(
  values: SimpleExpressionNode[],
  context: CodegenContext,
  jsx?: boolean,
): CodeFragment[] {
  return values.flatMap((value, i) => {
    let exp = genExpression(value, context)
    if (!jsx && getLiteralExpressionValue(value) == null) {
      // dynamic, wrap with toDisplayString
      exp = genCall(context.helper('toDisplayString'), exp)
    }
    if (i > 0) {
      exp.unshift(jsx ? ', ' : ' + ')
    }
    return exp
  })
}

export function genGetTextChild(
  oper: GetTextChildIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const {
    block: { dynamicComponents },
  } = context

  // if the parent is a dynamic component, don't need to generate a child
  // because it will use the `setElementText` helper directly.
  if (dynamicComponents.includes(oper.parent)) return []

  return [
    NEWLINE,
    `const x${oper.parent} = ${context.helper('child')}(n${oper.parent})`,
  ]
}
