import type { CodegenContext } from '../generate'
import type { SlotOutletIRNode } from '../ir'
import { genBlock } from './block'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, buildCodeFragment, genCall } from './utils'
import { genRawProps } from './component'

export function genSlotOutlet(
  oper: SlotOutletIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const { id, name, fallback, noSlotted } = oper
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
      helper('createSlot'),
      nameExpr,
      genRawProps(oper.props, context) || 'null',
      fallbackArg,
      noSlotted && 'undefined', // instance
      noSlotted && 'true', // noSlotted
    ),
  )

  return frag
}
