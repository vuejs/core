import type { CodegenContext } from '../generate'
import { type BlockIRNode, IRNodeTypes, type IfIRNode } from '../ir'
import { VaporBlockShape, VaporIfFlags } from '@vue/shared'
import { genBlock } from './block'
import { genExpression } from './expression'
import {
  type CodeFragment,
  DELIMITERS_ARRAY,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
  genCall,
  genFlags,
  genMulti,
} from './utils'
import { isLongIfChain } from '../utils'

export function genIf(
  oper: IfIRNode,
  context: CodegenContext,
  isNested = false,
): CodeFragment[] {
  if (!isNested && isLongIfChain(oper)) {
    return genIfChain(oper, context)
  }
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
    genExpression(condition, context),
    ')',
  ]

  let positiveArg = genBlock(positive, context)
  let negativeArg: false | CodeFragment[] = false

  if (negative) {
    if (negative.type === IRNodeTypes.BLOCK) {
      negativeArg = genBlock(negative, context)
    } else {
      negativeArg = ['() => ', genIf(negative!, context, true)]
    }
  }

  if (!isNested) push(NEWLINE, `const n${oper.id} = `)
  push(
    genCall(helper('createIf'), conditionExpr, positiveArg, negativeArg, flags),
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
    ? genFlags(flags, genIfFlagNames(once, slotRoot, index, blockShape))
    : String(flags)
}

function genIfFlagNames(
  once: boolean | undefined,
  slotRoot: boolean | undefined,
  index: number | undefined,
  blockShape: number,
): string[] {
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

  return names
}

function genBlockShapeName(flags: number): string {
  switch (flags & 0b11) {
    case VaporBlockShape.EMPTY:
      return 'EMPTY'
    case VaporBlockShape.SINGLE_ROOT:
      return 'SINGLE_ROOT'
    case VaporBlockShape.MULTI_ROOT:
      return 'MULTI_ROOT'
    case VaporBlockShape.ELSE_IF:
      return 'ELSE_IF'
  }
  return 'UNKNOWN'
}

// `() => (a) ? 0 : (b) ? 1 : 2` selects the branch, `blocks.length` past the
// last one; branch flags describe every branch plus that empty state.
function genIfChain(oper: IfIRNode, context: CodegenContext): CodeFragment[] {
  const { helper } = context
  const [frag, push] = buildCodeFragment()
  const selector: CodeFragment[] = ['() => ', INDENT_START]
  const blocks: CodeFragment[][] = []
  const branchFlags: number[] = []
  let slotRoot = false
  let node = oper
  for (let i = 0; ; i++) {
    if (i > 0) selector.push(NEWLINE, ': ')
    selector.push('(', genExpression(node.condition, context), `) ? ${i}`)
    blocks.push(genBlock(node.positive, context))
    branchFlags.push(node.blockShape & (0b11 | VaporIfFlags.TRUE_NO_SCOPE))
    if (node.slotRoot) slotRoot = true
    const { negative } = node
    if (negative && negative.type === IRNodeTypes.IF) {
      node = negative
      continue
    }
    selector.push(NEWLINE, `: ${i + 1}`, INDENT_END)
    if (negative) blocks.push(genBlock(negative as BlockIRNode, context))
    // the `v-else` branch, or the empty state the selector lands on without one
    branchFlags.push(
      ((node.blockShape >> 2) & 0b11) |
        (node.blockShape & VaporIfFlags.FALSE_NO_SCOPE
          ? VaporIfFlags.TRUE_NO_SCOPE
          : 0),
    )
    break
  }

  push(
    NEWLINE,
    `const n${oper.id} = `,
    genCall(
      helper('createIfChain'),
      selector,
      genMulti(DELIMITERS_ARRAY, ...blocks),
      genIfChainBranchFlags(branchFlags, blocks.length),
      genIfChainFlags(oper.once, slotRoot, oper.index!),
    ),
  )
  return frag
}

function genIfChainBranchFlags(
  branchFlags: number[],
  blockCount: number,
): CodeFragment[] | false {
  // the runtime default: scoped single roots, and an empty state
  if (
    branchFlags.every(
      (flags, i) =>
        flags ===
        (i < blockCount ? VaporBlockShape.SINGLE_ROOT : VaporBlockShape.EMPTY),
    )
  ) {
    return false
  }
  return genMulti(
    DELIMITERS_ARRAY,
    ...branchFlags.map(flags => {
      const names = [genBlockShapeName(flags)]
      if (flags & VaporIfFlags.TRUE_NO_SCOPE) names.push('NO_SCOPE')
      return genFlags(flags, names)
    }),
  )
}

function genIfChainFlags(
  once: boolean | undefined,
  slotRoot: boolean,
  index: number,
): string {
  let flags = 0
  const names: string[] = []
  if (once) {
    flags |= VaporIfFlags.ONCE
    names.push('ONCE')
  } else {
    flags |= (index + 1) << VaporIfFlags.INDEX_SHIFT
    names.push(`KEYED_INDEX_${index}`)
  }
  if (slotRoot) {
    flags |= VaporIfFlags.SLOT_ROOT
    names.push('SLOT_ROOT')
  }
  return genFlags(flags, names)
}
