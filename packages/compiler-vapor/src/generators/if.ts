import type { CodegenContext } from '../generate'
import { IRNodeTypes, type IfIRNode } from '../ir'
import { genBlock } from './block'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, buildCodeFragment, genCall } from './utils'

export function genIf(
  oper: IfIRNode,
  context: CodegenContext,
  isNested = false,
): CodeFragment[] {
  const { helper } = context
  const { condition, positive, negative, once } = oper
  const [frag, push] = buildCodeFragment()

  const codes: CodeFragment[] = [
    isNested ? '(' : '() => (',
    ...genExpression(condition, context),
    ')',
  ]

  let positiveArg = genBlock(positive, context)
  let negativeArg: false | CodeFragment[] = false

  if (negative) {
    positiveArg.unshift(' ? ')
    negativeArg = [' : ']
    if (negative.type === IRNodeTypes.BLOCK) {
      negativeArg.push(...genBlock(negative, context))
    } else {
      negativeArg.push(...genIf(negative!, context, true))
    }
  } else {
    positiveArg.unshift(' ? ')
    positiveArg.push(' : undefined')
  }

  codes.push(...positiveArg)
  if (negativeArg) codes.push(...negativeArg)

  if (isNested) {
    push(...codes)
  } else {
    push(NEWLINE, `const n${oper.id} = `)
    push(...genCall(helper('createIf'), codes, once && 'true'))
  }

  return frag
}
