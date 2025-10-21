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
  const { helper } = context
  const { element, values, generated, jsx, isComponent } = oper
  const texts = combineValues(values, context, jsx)
  return [
    NEWLINE,
    ...genCall(
      // use setBlockText for component
      isComponent ? helper('setBlockText') : helper('setText'),
      `${generated && !isComponent ? 'x' : 'n'}${element}`,
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
  return [
    NEWLINE,
    `const x${oper.parent} = ${context.helper('txt')}(n${oper.parent})`,
  ]
}
