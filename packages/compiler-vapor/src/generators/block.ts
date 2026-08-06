import type {
  BlockIRNode,
  CoreHelper,
  CreateComponentIRNode,
  ForIRNode,
  IRDynamicInfo,
  IRSlots,
  IfIRNode,
  OperationNode,
} from '../ir'
import { IRNodeTypes, IRSlotType, isBlockOperation } from '../ir'
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
  skippedEffectIndexes?: Set<number>,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  const { dynamic, effect, operation, returns } = block
  // Built-in v-model needs to run after initial DOM props are applied. This is
  // especially important for inputs with a dynamic type, since the runtime
  // selects the text, checkbox, or radio implementation from the DOM property.
  const modelOperations = operation.filter(isVModelOperation)
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
      const oper = operation[operationIndex]
      if (!isVModelOperation(oper)) {
        push(...genOperationWithInsertionState(oper, context))
      }
      operationIndex++
    }

    if (effectIndex < effectEnd) {
      push(...genEffectRange(effectIndex, effectEnd))
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
    push(
      ...genOperations(
        operation
          .slice(operationIndex)
          .filter(oper => !isVModelOperation(oper)),
        context,
      ),
    )
  }
  if (effectIndex < effect.length) {
    push(...genEffectRange(effectIndex, effect.length, genEffectsExtraFrag))
  } else if (genEffectsExtraFrag) {
    push(...genEffects([], context, genEffectsExtraFrag))
  }
  if (modelOperations.length) {
    push(...genOperations(modelOperations, context))
  }

  push(NEWLINE, `return `)

  const returnNodes = returns.map(n => `n${n}`)
  const returnsCode: CodeFragment[] =
    returnNodes.length > 1
      ? genMulti(DELIMITERS_ARRAY, ...returnNodes)
      : [returnNodes[0] || '[]']
  push(...returnsCode)

  resetBlock()
  context.singleUseAssetComponentNames = prevSingleUseAssetComponentNames
  return frag

  function genEffectRange(
    start: number,
    end: number,
    genExtraFrag?: () => CodeFragment[],
  ): CodeFragment[] {
    if (!skippedEffectIndexes) {
      return genEffects(effect.slice(start, end), context, genExtraFrag)
    }

    const effects: typeof effect = []
    for (let i = start; i < end; i++) {
      if (!skippedEffectIndexes.has(i)) {
        effects.push(effect[i])
      }
    }

    if (effects.length || genExtraFrag) {
      return genEffects(effects, context, genExtraFrag)
    }
    return []
  }

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

function isVModelOperation(oper: OperationNode): boolean {
  return (
    oper.type === IRNodeTypes.DIRECTIVE &&
    oper.builtin === true &&
    oper.name === 'model'
  )
}

export function markSlotRootOperations(
  block: BlockIRNode,
  context: CodegenContext,
  sharedFallback: boolean = false,
): void {
  if (hasStableSlotRoot(block, context)) return
  sharedFallback = sharedFallback || hasMultipleDynamicSlotRoots(block)

  for (let i = 0; i < block.returns.length; i++) {
    const child = findReturnedDynamic(block, block.returns[i])
    const operation = child && child.operation
    if (!operation) continue

    if (operation.type === IRNodeTypes.IF) {
      markSlotRootIf(operation, context, sharedFallback)
    } else if (operation.type === IRNodeTypes.FOR) {
      markSlotRootFor(operation, context)
    } else if (operation.type === IRNodeTypes.KEY) {
      operation.slotRoot = true
      markSlotRootOperations(operation.block, context, sharedFallback)
    } else if (operation.type === IRNodeTypes.CREATE_COMPONENT_NODE) {
      markSlotRootComponent(operation)
    } else if (operation.type === IRNodeTypes.SLOT_OUTLET_NODE) {
      if (!(operation.flags & VaporSlotFlags.ONCE)) {
        operation.flags |= VaporSlotFlags.SLOT_ROOT
      }
      if (sharedFallback) {
        operation.flags |= VaporSlotFlags.SHARED_FALLBACK
      } else {
        operation.flags |= VaporSlotFlags.INHERIT_FALLBACK
      }
    }
  }
}

function markSlotRootIf(
  operation: IfIRNode,
  context: CodegenContext,
  sharedFallback: boolean,
): void {
  if (!operation.once) {
    operation.slotRoot = true
  }
  markSlotRootOperations(operation.positive, context, sharedFallback)

  const negative = operation.negative
  if (!negative) return
  if (negative.type === IRNodeTypes.IF) {
    markSlotRootIf(negative, context, sharedFallback)
  } else {
    markSlotRootOperations(negative, context, sharedFallback)
  }
}

function markSlotRootFor(operation: ForIRNode, context: CodegenContext): void {
  if (!operation.once) {
    operation.slotRoot = true
  }
  markSlotRootOperations(operation.render, context, true)
}

function hasMultipleDynamicSlotRoots(block: BlockIRNode): boolean {
  let count = 0
  for (let i = 0; i < block.returns.length; i++) {
    const child = findReturnedDynamic(block, block.returns[i])
    if (child && child.operation && ++count > 1) return true
  }
  return false
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

const commentOnlyTemplateRE = /^(?:<!--[\s\S]*?-->)+$/

// A slot can skip fallback/boundary tracking when at least one root is stable.
// Components count as valid even if their own render result is a comment.
export function hasStableSlotRoot(
  block: BlockIRNode,
  context: CodegenContext,
): boolean {
  let hasValidRoot = false
  for (let i = 0; i < block.returns.length; i++) {
    const id = block.returns[i]
    const child = findReturnedDynamic(block, id)
    const operation = child && child.operation
    if (!operation) {
      if (child && isStableTemplateSlotRoot(child, context)) {
        hasValidRoot = true
      }
      continue
    }

    switch (operation.type) {
      case IRNodeTypes.CREATE_COMPONENT_NODE:
        if (!operation.dynamic || operation.dynamic.isStatic) {
          hasValidRoot = true
          continue
        }
        // Align with VDOM fallback semantics:
        // <component :is="view" /> renders fallback when view is null because
        // the dynamic component root becomes a comment vnode. This differs from
        // <Foo />, whose component vnode is valid slot content even if Foo
        // renders null/comment. Keep scanning because a stable sibling can
        // still make the whole slot content valid.
        continue
      case IRNodeTypes.KEY:
        if (hasStableSlotRoot(operation.block, context)) {
          hasValidRoot = true
          continue
        }
        continue
      default:
        continue
    }
  }
  return hasValidRoot
}

function isStableTemplateSlotRoot(
  child: IRDynamicInfo,
  context: CodegenContext,
): boolean {
  if (child.template == null) return false
  const content = context.ir.template.entries[child.template].content
  // Preserved whitespace is a real text root; trim only for comment detection.
  return content !== '' && !commentOnlyTemplateRE.test(content.trim())
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
