import type { CodegenContext } from '../generate'
import type { SlotOutletIRNode } from '../ir'
import { genBlock } from './block'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, buildCodeFragment, genCall } from './utils'
import { genRawProps } from './component'

export const createForwardedSlotIdent = `_createForwardedSlot`

export function genSlotOutlet(
  oper: SlotOutletIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const { id, name, fallback, forwarded } = oper
  const [frag, push] = buildCodeFragment()

  const nameExpr = name.isStatic
    ? genExpression(name, context)
    : ['() => (', ...genExpression(name, context), ')']

  let fallbackArg: CodeFragment[] | undefined
  if (fallback) {
    fallbackArg = genBlock(fallback, context)
  }

  push(
    NEWLINE,
    `const n${id} = `,
    ...genCall(
      forwarded ? createForwardedSlotIdent : helper('createSlot'),
      nameExpr,
      genRawProps(oper.props, context) || 'null',
      fallbackArg,
    ),
  )

  return frag
}
