import {
  NewlineType,
  type SimpleExpressionNode,
  type SourceLocation,
} from '@vue/compiler-dom'
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
  const { element, values, locs, generated } = oper
  const texts = combineValues(values, locs, context)
  return [
    NEWLINE,
    genCall(helper('setText'), `${generated ? 'x' : 'n'}${element}`, texts),
  ]
}

function combineValues(
  values: SimpleExpressionNode[],
  locs: SourceLocation[],
  context: CodegenContext,
): CodeFragment[] {
  return values.flatMap((value, i) => {
    let exp = genExpression(value, context)
    if (getLiteralExpressionValue(value, true) == null) {
      // dynamic, wrap with toDisplayString
      exp = [
        [`${context.helper('toDisplayString')}(`, NewlineType.None, locs[i]],
        ...exp,
        ')',
      ]
    }
    if (i > 0) {
      exp.unshift(' + ')
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
