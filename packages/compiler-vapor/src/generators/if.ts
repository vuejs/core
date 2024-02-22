import type { CodegenContext } from '../generate'
import { IRNodeTypes, type IfIRNode } from '../ir'
import { genBlockFunction } from './block'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, buildCodeFragment, genCall } from './utils'

export function genIf(
  oper: IfIRNode,
  context: CodegenContext,
  isNested = false,
): CodeFragment[] {
  const { vaporHelper } = context
  const { condition, positive, negative } = oper
  const [frag, push] = buildCodeFragment()

  const conditionExpr: CodeFragment[] = [
    '() => (',
    ...genExpression(condition, context),
    ')',
  ]

  let positiveArg = genBlockFunction(positive, context)
  let negativeArg: false | CodeFragment[] = false

  if (negative) {
    if (negative.type === IRNodeTypes.BLOCK) {
      negativeArg = genBlockFunction(negative, context)
    } else {
      negativeArg = ['() => ', ...genIf(negative!, context, true)]
    }
  }

  if (!isNested) push(NEWLINE, `const n${oper.id} = `)
  push(
    ...genCall(
      vaporHelper('createIf'),
      conditionExpr,
      positiveArg,
      negativeArg,
    ),
  )

  return frag
}
