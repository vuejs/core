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
import { genSelf } from './template'
import { genCustomDirectives } from './directive'
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
    args,
    ') => {',
    INDENT_START,
    genBlockContent(oper, context, root),
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
  const {
    dynamic,
    effect,
    operation,
    returns,
    deferredOperationIndex,
    deferredEffectIndex,
  } = block
  const resetBlock = context.enterBlock(block)
  const singleUseAssetComponentNames = root
    ? collectSingleUseAssetComponents(block, context.ir.component)
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
        genCall(
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
      push(genOperationWithInsertionState(operation[operationIndex], context))
      operationIndex++
    }

    if (effectIndex < effectEnd) {
      push(genEffectRange(effectIndex, effectEnd))
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
    push(genSelf(child, context, flushBeforeDynamic))
  }

  if (operationIndex < deferredOperationIndex) {
    push(
      genOperations(
        operation.slice(operationIndex, deferredOperationIndex),
        context,
      ),
    )
  }
  if (effectIndex < deferredEffectIndex) {
    push(genEffectRange(effectIndex, deferredEffectIndex, genEffectsExtraFrag))
  } else if (genEffectsExtraFrag) {
    push(genEffects([], context, genEffectsExtraFrag))
  }
  // v-model directives and the listeners of their elements, see finalizeBlock
  if (deferredOperationIndex < operation.length) {
    push(genOperations(operation.slice(deferredOperationIndex), context))
  }
  if (deferredEffectIndex < effect.length) {
    push(genEffectRange(deferredEffectIndex, effect.length))
  }
  push(genCustomDirectives(operation, context))

  push(NEWLINE, `return `)

  const returnNodes = returns.map(n => `n${n}`)
  const returnsCode: CodeFragment[] =
    returnNodes.length > 1
      ? genMulti(DELIMITERS_ARRAY, ...returnNodes)
      : [returnNodes[0] || '[]']
  push(returnsCode)

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
        genCall(context.helper(helper), JSON.stringify(name)),
      )
    }
  }
}

// Marks the root operations of a slot block that has no stable root, and
// returns whether it has one (nothing is marked then).
export function markSlotRootOperations(
  block: BlockIRNode,
  context: CodegenContext,
): boolean {
  const roots = getReturnedDynamics(block)
  if (hasStableSlotRoot(roots, context)) return true

  for (let i = 0; i < roots.length; i++) {
    const child = roots[i]
    const operation = child && child.operation
    if (!operation) continue

    if (operation.type === IRNodeTypes.IF) {
      markSlotRootIf(operation, context)
    } else if (operation.type === IRNodeTypes.FOR) {
      markSlotRootFor(operation, context)
    } else if (operation.type === IRNodeTypes.KEY) {
      operation.slotRoot = true
      markSlotRootOperations(operation.block, context)
    } else if (operation.type === IRNodeTypes.CREATE_COMPONENT_NODE) {
      markSlotRootComponent(operation)
    } else if (operation.type === IRNodeTypes.SLOT_OUTLET_NODE) {
      operation.flags |= VaporSlotFlags.FORWARDED
    }
  }
  return false
}

function markSlotRootIf(operation: IfIRNode, context: CodegenContext): void {
  if (!operation.once) {
    operation.slotRoot = true
  }
  markSlotRootOperations(operation.positive, context)

  const negative = operation.negative
  if (!negative) return
  if (negative.type === IRNodeTypes.IF) {
    markSlotRootIf(negative, context)
  } else {
    markSlotRootOperations(negative, context)
  }
}

function markSlotRootFor(operation: ForIRNode, context: CodegenContext): void {
  if (!operation.once) {
    operation.slotRoot = true
  }
  markSlotRootOperations(operation.render, context)
}

function markSlotRootComponent(operation: CreateComponentIRNode): void {
  if (!operation.once && operation.dynamic && !operation.dynamic.isStatic) {
    operation.slotRoot = true
  }
}

// the dynamic info of each returned root, in `returns` order
function getReturnedDynamics(
  block: BlockIRNode,
): (IRDynamicInfo | undefined)[] {
  const { children } = block.dynamic
  const byId = new Map<number, IRDynamicInfo>()
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.id !== undefined) byId.set(child.id, child)
  }
  return block.returns.map(id => byId.get(id))
}

const commentOnlyTemplateRE = /^(?:<!--[\s\S]*?-->)+$/

// A slot can skip fallback/boundary tracking when at least one root is stable.
// Components count as valid even if their own render result is a comment.
function hasStableSlotRoot(
  roots: (IRDynamicInfo | undefined)[],
  context: CodegenContext,
): boolean {
  for (let i = 0; i < roots.length; i++) {
    const child = roots[i]
    const operation = child && child.operation
    if (!operation) {
      if (child && isStableTemplateSlotRoot(child, context)) return true
      continue
    }

    switch (operation.type) {
      case IRNodeTypes.CREATE_COMPONENT_NODE:
        if (!operation.dynamic || operation.dynamic.isStatic) return true
        // Align with VDOM fallback semantics:
        // <component :is="view" /> renders fallback when view is null because
        // the dynamic component root becomes a comment vnode. This differs from
        // <Foo />, whose component vnode is valid slot content even if Foo
        // renders null/comment. Keep scanning because a stable sibling can
        // still make the whole slot content valid.
        continue
      case IRNodeTypes.KEY:
        if (hasStableSlotRoot(getReturnedDynamics(operation.block), context)) {
          return true
        }
        continue
      default:
        continue
    }
  }
  return false
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

function collectSingleUseAssetComponents(
  block: BlockIRNode,
  assetComponents: Set<string>,
): Set<string> {
  const usageMap = new Map<string, AssetComponentUsage>()
  const seenOperations = new Set<OperationNode>()

  // createAssetComponent is only emitted from the root block. Nested blocks,
  // including component slots, still need the hoisted resolveComponent binding.
  visitBlock(block, true)

  const names = new Set<string>()

  for (const [name, usage] of usageMap) {
    if (usage.count === 1 && usage.root && assetComponents.has(name)) {
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
