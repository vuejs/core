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
  const names = [`TRUE_${genBlockShapeName(blockShape)}`]
  const falseShape = blockShape >> 2
  const hasFalseBranch = (falseShape & 0b11) !== VaporBlockShape.EMPTY

  if (hasFalseBranch) {
    names.push(`FALSE_${genBlockShapeName(falseShape)}`)
  }

  if (blockShape & VaporIfFlags.TRUE_NO_SCOPE) {
    names.push('TRUE_NO_SCOPE')
  }
  if (hasFalseBranch && blockShape & VaporIfFlags.FALSE_NO_SCOPE) {
    names.push('FALSE_NO_SCOPE')
  }

  if (once) {
    names.push('ONCE')
  }
  if (slotRoot) {
    names.push('SLOT_ROOT')
  }
  if (!once && index !== undefined) {
    names.push(`KEYED_INDEX_${index}`)
  }

  return names.join(', ')
}

function genBlockShapeName(flags: number): string {
  switch (flags & 0b11) {
    case VaporBlockShape.EMPTY:
      return 'EMPTY'
    case VaporBlockShape.SINGLE_ROOT:
      return 'SINGLE_ROOT'
    case VaporBlockShape.MULTI_ROOT:
      return 'MULTI_ROOT'
  }
  return 'UNKNOWN'
}
