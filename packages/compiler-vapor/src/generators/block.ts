import type {
  BlockIRNode,
  CoreHelper,
  CreateComponentIRNode,
  ForIRNode,
  IRDynamicInfo,
  IRSlots,
  IfIRNode,
} from '../ir'
import {
  IRNodeTypes,
  IRSlotType,
  type OperationNode,
  isBlockOperation,
} from '../ir'
import {
  type CodeFragment,
  DELIMITERS_ARRAY,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
  genCall,
  genMulti,
} from './utils'
import type { CodegenContext } from '../generate'
import {
  genEffects,
  genOperationWithInsertionState,
  genOperations,
} from './operation'
import { genChildren, genSelf } from './template'
import { toValidAssetId } from '@vue/compiler-dom'
import { VaporSlotFlags } from '@vue/shared'

export function genBlock(
  oper: BlockIRNode,
  context: CodegenContext,
  args: CodeFragment[] = [],
  root?: boolean,
): CodeFragment[] {
  return [
    '(',
    ...args,
    ') => {',
    INDENT_START,
    ...genBlockContent(oper, context, root),
    INDENT_END,
    NEWLINE,
    '}',
  ]
}

export function genBlockContent(
  block: BlockIRNode,
  context: CodegenContext,
  root?: boolean,
  genEffectsExtraFrag?: () => CodeFragment[],
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  const { dynamic, effect, operation, returns } = block
  const resetBlock = context.enterBlock(block)
  const singleUseAssetComponentNames = root
    ? collectSingleUseAssetComponents(block)
    : undefined
  const prevSingleUseAssetComponentNames = context.singleUseAssetComponentNames

  if (singleUseAssetComponentNames) {
    context.singleUseAssetComponentNames = singleUseAssetComponentNames
  }

  if (root) {
    for (let name of context.ir.component) {
      if (
        singleUseAssetComponentNames &&
        singleUseAssetComponentNames.has(name)
      ) {
        continue
      }
      const id = toValidAssetId(name, 'component')
      const maybeSelfReference = name.endsWith('__self')
      if (maybeSelfReference) name = name.slice(0, -6)
      push(
        NEWLINE,
        `const ${id} = `,
        ...genCall(
          context.helper('resolveComponent'),
          JSON.stringify(name),
          // pass additional `maybeSelfReference` flag
          maybeSelfReference ? 'true' : undefined,
        ),
      )
    }
    genResolveAssets('directive', 'resolveDirective')
  }

  let operationIndex = 0
  let effectIndex = 0
  const flushPendingOperations = (
    operationEnd: number,
    effectEnd: number,
    push: (...items: CodeFragment[]) => number,
  ) => {
    while (operationIndex < operationEnd) {
      push(
        ...genOperationWithInsertionState(operation[operationIndex], context),
      )
      operationIndex++
    }

    if (effectIndex < effectEnd) {
      push(...genEffects(effect.slice(effectIndex, effectEnd), context))
      effectIndex = effectEnd
    }
  }
  const flushBeforeDynamic = (
    dynamic: IRDynamicInfo,
    push: (...items: CodeFragment[]) => number,
  ) => {
    const operation = dynamic.operation
    if (
      operation &&
      isBlockOperation(operation) &&
      operation.operationIndex !== undefined &&
      operation.effectIndex !== undefined
    ) {
      flushPendingOperations(
        operation.operationIndex,
        operation.effectIndex,
        push,
      )
    }
  }

  for (const child of dynamic.children) {
    flushBeforeDynamic(child, push)
    push(...genSelf(child, context, flushBeforeDynamic))
  }
  for (const child of dynamic.children) {
    if (!child.hasDynamicChild) {
      push(
        ...genChildren(
          child,
          context,
          push,
          `n${child.id!}`,
          flushBeforeDynamic,
        ),
      )
    }
  }

  if (operationIndex < operation.length) {
    push(...genOperations(operation.slice(operationIndex), context))
  }
  if (effectIndex < effect.length) {
    push(...genEffects(effect.slice(effectIndex), context, genEffectsExtraFrag))
  } else if (genEffectsExtraFrag) {
    push(...genEffects([], context, genEffectsExtraFrag))
  }

  push(NEWLINE, `return `)

  const returnNodes = returns.map(n => `n${n}`)
  const returnsCode: CodeFragment[] =
    returnNodes.length > 1
      ? genMulti(DELIMITERS_ARRAY, ...returnNodes)
      : [returnNodes[0] || 'null']
  push(...returnsCode)

  resetBlock()
  context.singleUseAssetComponentNames = prevSingleUseAssetComponentNames
  return frag

  function genResolveAssets(
    kind: 'component' | 'directive',
    helper: CoreHelper,
  ) {
    for (const name of context.ir[kind]) {
      push(
        NEWLINE,
        `const ${toValidAssetId(name, kind)} = `,
        ...genCall(context.helper(helper), JSON.stringify(name)),
      )
    }
  }
}

export function markSlotRootOperations(block: BlockIRNode): void {
  for (let i = 0; i < block.returns.length; i++) {
    const child = findReturnedDynamic(block, block.returns[i])
    const operation = child && child.operation
    if (!operation) continue

    if (operation.type === IRNodeTypes.IF) {
      markSlotRootIf(operation)
    } else if (operation.type === IRNodeTypes.FOR) {
      markSlotRootFor(operation)
    } else if (operation.type === IRNodeTypes.SLOT_OUTLET_NODE) {
      markSlotRootSlotOutlet(operation)
    } else if (operation.type === IRNodeTypes.CREATE_COMPONENT_NODE) {
      markSlotRootComponent(operation)
    }
  }
}

function markSlotRootIf(operation: IfIRNode): void {
  if (!operation.once) {
    operation.slotRoot = true
  }
  markSlotRootOperations(operation.positive)

  const negative = operation.negative
  if (!negative) return
  if (negative.type === IRNodeTypes.IF) {
    markSlotRootIf(negative)
  } else {
    markSlotRootOperations(negative)
  }
}

function markSlotRootFor(operation: ForIRNode): void {
  if (!operation.once) {
    operation.slotRoot = true
  }
  markSlotRootOperations(operation.render)
}

function markSlotRootSlotOutlet(
  operation: Extract<OperationNode, { type: IRNodeTypes.SLOT_OUTLET_NODE }>,
): void {
  operation.flags |= VaporSlotFlags.SLOT_ROOT
  if (operation.fallback) {
    markSlotRootOperations(operation.fallback)
  }
}

function markSlotRootComponent(operation: CreateComponentIRNode): void {
  if (!operation.once && operation.dynamic && !operation.dynamic.isStatic) {
    operation.slotRoot = true
  }
}

export function findReturnedDynamic(
  block: BlockIRNode,
  id: number,
): IRDynamicInfo | undefined {
  for (let i = 0; i < block.dynamic.children.length; i++) {
    const child = block.dynamic.children[i]
    if (child.id === id) return child
  }
}

interface AssetComponentUsage {
  count: number
  root: boolean
}

function collectSingleUseAssetComponents(block: BlockIRNode): Set<string> {
  const usageMap = new Map<string, AssetComponentUsage>()
  const seenOperations = new Set<OperationNode>()

  // createAssetComponent is only emitted from the root block. Nested blocks,
  // including component slots, still need the hoisted resolveComponent binding.
  visitBlock(block, true)

  const names = new Set<string>()

  for (const [name, usage] of usageMap) {
    if (usage.count === 1 && usage.root) {
      names.add(name)
    }
  }

  return names

  function visitBlock(block: BlockIRNode, rootCandidate: boolean) {
    visitDynamic(block.dynamic, rootCandidate)

    for (const operation of block.operation) {
      visitOperation(operation, rootCandidate)
    }

    for (const effect of block.effect) {
      for (const operation of effect.operations) {
        visitOperation(operation, false)
      }
    }
  }

  function visitDynamic(dynamic: IRDynamicInfo, rootCandidate: boolean) {
    if (dynamic.operation) {
      visitOperation(dynamic.operation, rootCandidate)
    }

    for (const child of dynamic.children) {
      visitDynamic(child, rootCandidate)
    }
  }

  function visitOperation(operation: OperationNode, rootCandidate: boolean) {
    if (seenOperations.has(operation)) {
      return
    }
    seenOperations.add(operation)

    if (operation.type === IRNodeTypes.CREATE_COMPONENT_NODE) {
      if (operation.asset) {
        const usage = usageMap.get(operation.tag) || {
          count: 0,
          root: false,
        }
        usage.count++
        if (rootCandidate) {
          usage.root = true
        }
        usageMap.set(operation.tag, usage)
      }

      visitSlots(operation.slots)
      return
    }

    switch (operation.type) {
      case IRNodeTypes.IF:
        visitBlock(operation.positive, false)
        if (operation.negative) {
          if (operation.negative.type === IRNodeTypes.IF) {
            visitOperation(operation.negative, false)
          } else {
            visitBlock(operation.negative, false)
          }
        }
        break
      case IRNodeTypes.FOR:
        visitBlock(operation.render, false)
        break
      case IRNodeTypes.KEY:
        visitBlock(operation.block, false)
        break
      case IRNodeTypes.SLOT_OUTLET_NODE:
        if (operation.fallback) {
          visitBlock(operation.fallback, false)
        }
        break
    }
  }

  function visitSlots(slots: IRSlots[]) {
    for (const slot of slots) {
      switch (slot.slotType) {
        case IRSlotType.STATIC:
          for (const name in slot.slots) {
            visitBlock(slot.slots[name], false)
          }
          break
        case IRSlotType.DYNAMIC:
        case IRSlotType.LOOP:
          visitBlock(slot.fn, false)
          break
        case IRSlotType.CONDITIONAL:
          visitSlots([slot.positive])
          if (slot.negative) {
            visitSlots([slot.negative])
          }
          break
      }
    }
  }
}
