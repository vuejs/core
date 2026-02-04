import type { CodegenContext } from '../generate'
import type { KeyIRNode } from '../ir'
import { genBlock } from './block'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, buildCodeFragment, genCall } from './utils'

export function genKey(
  oper: KeyIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { id, value, block } = oper
  const [frag, push] = buildCodeFragment()
  const blockFn = genBlock(block, context)

  push(
    NEWLINE,
    `const n${id} = `,
    ...genCall(
      context.helper('createKeyedFragment'),
      [`() => (`, ...genExpression(value, context), ')'],
      blockFn,
    ),
  )

  return frag
}
