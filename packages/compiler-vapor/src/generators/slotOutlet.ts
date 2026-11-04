import type { CodegenContext } from '../generate'
import type { IRProps, IRPropsDynamicExpression, SlotOutletIRNode } from '../ir'
import { VaporSlotFlags, isArray } from '@vue/shared'
import { genBlock, markSlotRootOperations } from './block'
import { genExpression } from './expression'
import {
  type CodeFragment,
  NEWLINE,
  buildCodeFragment,
  genCall,
  genFlags,
} from './utils'
import { genRawProps } from './component'
import { genLiteralObjectProps } from './prop'

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
      markSlotRootOperations(fallback, context)
    }
    fallbackArg = genBlock(fallback, context)
  }
  const createSlot = helper('createSlot')
  const rawPropsArg = genSlotProps(oper.props, context)
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
      : ['() => (', genExpression(name, context), ')']

  push(
    NEWLINE,
    `const n${id} = `,
    genCall(createSlot, nameArg, rawPropsArg, fallbackArg, genSlotFlags(flags)),
  )

  return frag
}

function genSlotProps(
  props: IRProps[],
  context: CodegenContext,
): CodeFragment[] | undefined {
  if (!props.length) return
  const first = props[0]
  if (
    props.length === 1 &&
    isArray(first) &&
    first.every(prop => prop.key.isStatic)
  ) {
    return genRawProps(props, context, true)
  }

  const { helper } = context
  const groups = props.map(group => {
    if (isArray(group)) {
      return genLiteralObjectProps(group, context, true)
    }
    // Slot outlets keep dynamic keys in their original object group.
    const value = genExpression(
      (group as IRPropsDynamicExpression).value,
      context,
    )
    return group.handler ? genCall(helper('toHandlers'), value) : value
  })
  let value = groups[0]
  if (groups.length > 1) {
    value = genCall(helper('mergeProps'), ...groups)
  } else if (isArray(first)) {
    if (first.some(prop => !prop.key.isStatic && !prop.handler)) {
      value = genCall(helper('normalizeProps'), value)
    }
  } else if (!first.handler) {
    value = genCall(
      helper('normalizeProps'),
      genCall(helper('guardReactiveProps'), value),
    )
  }
  return ['{ $: [() => (', value, ')] }']
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
  if (flags & VaporSlotFlags.FORWARDED) {
    names.push('FORWARDED')
  }

  return genFlags(flags, names)
}
