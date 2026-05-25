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
  const { id, name, fallback, flags } = oper
  const [frag, push] = buildCodeFragment()

  const nameExpr = name.isStatic
    ? genExpression(name, context)
    : ['() => (', ...genExpression(name, context), ')']

  let fallbackArg: CodeFragment[] | undefined
  if (fallback) {
    fallbackArg = genBlock(fallback, context)
  }
  const createSlot = helper('createSlot')
  const rawPropsArg = genRawProps(oper.props, context)
  const omitDefaultName =
    name.isStatic &&
    name.content === 'default' &&
    !rawPropsArg &&
    !fallbackArg &&
    !flags

  push(
    NEWLINE,
    `const n${id} = `,
    ...genCall(
      createSlot,
      omitDefaultName ? undefined : nameExpr,
      rawPropsArg,
      fallbackArg,
      flags ? String(flags) : undefined,
    ),
  )

  return frag
}
