import type { CodegenContext } from '../generate'
import { IRNodeTypes, type IfIRNode } from '../ir'
import { VaporBlockShape, VaporIfFlags } from '@vue/shared'
import { genBlock } from './block'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, buildCodeFragment, genCall } from './utils'

export function genIf(
  oper: IfIRNode,
  context: CodegenContext,
  isNested = false,
): CodeFragment[] {
  const { helper } = context
  const { condition, positive, negative, once, slotRoot, index, blockShape } =
    oper
  const [frag, push] = buildCodeFragment()
  const flags = genIfFlags(
    blockShape,
    once,
    slotRoot,
    negative ? index : undefined,
  )

  const conditionExpr: CodeFragment[] = [
    '() => (',
    ...genExpression(condition, context),
    ')',
  ]

  let positiveArg = genBlock(positive, context)
  let negativeArg: false | CodeFragment[] = false

  if (negative) {
    if (negative.type === IRNodeTypes.BLOCK) {
      negativeArg = genBlock(negative, context)
    } else {
      negativeArg = ['() => ', ...genIf(negative!, context, true)]
    }
  }

  if (!isNested) push(NEWLINE, `const n${oper.id} = `)
  push(
    ...genCall(
      helper('createIf'),
      conditionExpr,
      positiveArg,
      negativeArg,
      flags,
    ),
  )

  return frag
}

function genIfFlags(
  blockShape: number,
  once: boolean | undefined,
  slotRoot: boolean | undefined,
  index: number | undefined,
): string | false {
  let flags = blockShape
  if (slotRoot) {
    flags |= VaporIfFlags.SLOT_ROOT
  }
  if (once) {
    flags |= VaporIfFlags.ONCE
  } else if (index !== undefined) {
    // The encoded index is shifted by +1 so runtime can use 0 as the unkeyed
    // sentinel while preserving source index 0.
    flags |= (index + 1) << VaporIfFlags.INDEX_SHIFT
  }

  // This is the only omitted-flags case: true branch is single-root, false
  // branch is empty, and there is no once/index metadata.
  if (flags === VaporBlockShape.SINGLE_ROOT) {
    return false
  }

  return __DEV__
    ? `${flags} /* ${genIfFlagNames(once, slotRoot, index, blockShape)} */`
    : String(flags)
}

function genIfFlagNames(
  once: boolean | undefined,
  slotRoot: boolean | undefined,
  index: number | undefined,
  blockShape: number,
): string {
  const names = ['BLOCK_SHAPE']

  if (blockShape & VaporIfFlags.TRUE_NO_SCOPE) {
    names.push('TRUE_NO_SCOPE')
  }
  if (blockShape & VaporIfFlags.FALSE_NO_SCOPE) {
    names.push('FALSE_NO_SCOPE')
  }

  if (once) {
    names.push('ONCE')
  }
  if (slotRoot) {
    names.push('SLOT_ROOT')
  }
  if (!once && index !== undefined) {
    names.push('INDEX_SHIFT')
  }

  return names.join(', ')
}
