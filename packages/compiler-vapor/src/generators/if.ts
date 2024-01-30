import { type CodegenContext, genBlockFunctionContent } from '../generate'
import { type BlockFunctionIRNode, IRNodeTypes, type IfIRNode } from '../ir'
import { genExpression } from './expression'

export function genIf(
  oper: IfIRNode,
  context: CodegenContext,
  isNested = false,
) {
  const { pushCall, vaporHelper, newline, push } = context
  const { condition, positive, negative } = oper

  let positiveArg = () => genBlockFunction(positive, context)
  let negativeArg: false | (() => void) = false

  if (negative) {
    if (negative.type === IRNodeTypes.BLOCK_FUNCTION) {
      negativeArg = () => genBlockFunction(negative, context)
    } else {
      negativeArg = () => {
        push('() => ')
        genIf(negative!, context, true)
      }
    }
  }

  if (!isNested) newline(`const n${oper.id} = `)
  pushCall(
    vaporHelper('createIf'),
    () => {
      push('() => (')
      genExpression(condition, context)
      push(')')
    },
    positiveArg,
    negativeArg,
  )
}

function genBlockFunction(oper: BlockFunctionIRNode, context: CodegenContext) {
  const { newline, push, withIndent } = context

  push('() => {')
  withIndent(() => {
    genBlockFunctionContent(oper, context)
  })
  newline('}')
}
