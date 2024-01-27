import { type CodegenContext, genBlockFunctionContent } from '../generate'
import type { BlockFunctionIRNode, IfIRNode } from '../ir'
import { genExpression } from './expression'

export function genIf(oper: IfIRNode, context: CodegenContext) {
  const { pushFnCall, vaporHelper, pushNewline, push, withIndent } = context
  const { condition, positive, negative } = oper

  pushNewline(`const n${oper.id} = `)
  pushFnCall(
    vaporHelper('createIf'),
    () => {
      push('() => (')
      genExpression(condition, context)
      push(')')
    },
    () => genBlockFunction(positive),
    !!negative && (() => genBlockFunction(negative!)),
  )

  function genBlockFunction(oper: BlockFunctionIRNode) {
    push('() => {')
    withIndent(() => {
      genBlockFunctionContent(oper, context)
    })
    pushNewline('}')
  }
}
