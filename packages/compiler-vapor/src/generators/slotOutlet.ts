import type { CodegenContext } from '../generate'
import type { SlotOutletIRNode } from '../ir'
import { genBlock, markSlotRootOperations } from './block'
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

  let fallbackArg: CodeFragment[] | undefined
  if (fallback) {
    if (context.inSlotBlock) {
      // Forwarded fallback validity affects the owning slot's exposed branch;
      markSlotRootOperations(fallback)
    }
    fallbackArg = genBlock(fallback, context)
  }
  const createSlot = helper('createSlot')
  const rawPropsArg = genRawProps(oper.props, context, true)
  const omitDefaultName =
    name.isStatic &&
    name.content === 'default' &&
    !rawPropsArg &&
    !fallbackArg &&
    !flags
  const nameArg = omitDefaultName
    ? undefined
    : name.isStatic
      ? genExpression(name, context)
      : ['() => (', ...genExpression(name, context), ')']

  push(
    NEWLINE,
    `const n${id} = `,
    ...genCall(
      createSlot,
      nameArg,
      rawPropsArg,
      fallbackArg,
      flags ? String(flags) : undefined,
    ),
  )

  return frag
}
