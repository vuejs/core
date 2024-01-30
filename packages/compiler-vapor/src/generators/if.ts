import {
  type CodeFragment,
  type CodegenContext,
  buildCodeFragment,
  genBlockFunctionContent,
} from '../generate'
import { type BlockFunctionIRNode, IRNodeTypes, type IfIRNode } from '../ir'
import { genExpression } from './expression'

export function genIf(
  oper: IfIRNode,
  context: CodegenContext,
  isNested = false,
): CodeFragment[] {
  const { call, vaporHelper, newline } = context
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
    if (negative.type === IRNodeTypes.BLOCK_FUNCTION) {
      negativeArg = genBlockFunction(negative, context)
    } else {
      negativeArg = ['() => ', ...genIf(negative!, context, true)]
    }
  }

  if (!isNested) push(newline(), `const n${oper.id} = `)
  push(
    ...call(vaporHelper('createIf'), conditionExpr, positiveArg, negativeArg),
  )

  return frag
}

function genBlockFunction(
  oper: BlockFunctionIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { newline, withIndent } = context
  return [
    '() => {',
    ...withIndent(() => genBlockFunctionContent(oper, context)),
    newline(),
    '}',
  ]
}
