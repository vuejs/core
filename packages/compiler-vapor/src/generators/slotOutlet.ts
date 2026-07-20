import type { CodegenContext } from '../generate'
import type { SlotOutletIRNode } from '../ir'
import { VaporSlotFlags } from '@vue/shared'
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
      genSlotFlags(flags),
    ),
  )

  return frag
}

function genSlotFlags(flags: number): string | undefined {
  if (!flags) {
    return undefined
  }

  const names: string[] = []
  if (flags & VaporSlotFlags.NO_SLOTTED) {
    names.push('NO_SLOTTED')
  }
  if (flags & VaporSlotFlags.ONCE) {
    names.push('ONCE')
  }
  if (flags & VaporSlotFlags.SLOT_ROOT) {
    names.push('SLOT_ROOT')
  }

  return __DEV__ ? `${flags} /* ${names.join(', ')} */` : String(flags)
}
