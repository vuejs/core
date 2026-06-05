import {
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type TemplateChildNode,
  createCompilerError,
  createSimpleExpression,
} from '@vue/compiler-dom'
import {
  type NodeTransform,
  type TransformContext,
  createStructuralDirectiveTransform,
} from '../transform'
import {
  type BlockIRNode,
  DynamicFlag,
  type IRDynamicInfo,
  IRNodeTypes,
  type IfIRNode,
  type VaporDirectiveNode,
} from '../ir'
import { VaporBlockShape, VaporIfFlags, extend } from '@vue/shared'
import { newBlock, wrapTemplate } from './utils'
import { getSiblingIf } from './transformComment'
import { getBlockShape, isInTransition, isStaticExpression } from '../utils'

export const transformVIf: NodeTransform = createStructuralDirectiveTransform(
  ['if', 'else', 'else-if'],
  processIf,
)

export function processIf(
  node: ElementNode,
  dir: VaporDirectiveNode,
  context: TransformContext<ElementNode>,
): (() => void) | undefined {
  if (dir.name !== 'else' && (!dir.exp || !dir.exp.content.trim())) {
    const loc = dir.exp ? dir.exp.loc : node.loc
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_IF_NO_EXPRESSION, dir.loc),
    )
    dir.exp = createSimpleExpression(`true`, false, loc)
  }

  context.dynamic.flags |= DynamicFlag.NON_TEMPLATE
  const forceMultiRoot = shouldForceMultiRoot(context)
  // Nested dynamic units are owned by an enclosing branch scope, so only mark
  // root-block branches with the compiler-proven no-scope flag.
  const allowNoScope = context.block === context.root.block
  if (dir.name === 'if') {
    const id = context.reference()
    context.dynamic.flags |= DynamicFlag.INSERT
    const [branch, onExit] = createIfBranch(node, context)

    return () => {
      onExit()
      context.dynamic.operation = {
        type: IRNodeTypes.IF,
        id,
        ...context.effectBoundary(),
        blockShape: encodeIfBlockShape(
          branch,
          forceMultiRoot,
          undefined,
          allowNoScope,
        ),
        condition: dir.exp!,
        positive: branch,
        index: context.root.nextIfIndex(),
        once:
          context.inVOnce ||
          isStaticExpression(dir.exp!, context.options.bindingMetadata),
      }
    }
  } else {
    // check the adjacent v-if
    const siblingIf = getSiblingIf(context, true)

    const siblings = context.parent && context.parent.dynamic.children
    let lastIfNode
    if (siblings) {
      let i = siblings.length
      while (i--) {
        if (
          siblings[i].operation &&
          siblings[i].operation!.type === IRNodeTypes.IF
        ) {
          lastIfNode = siblings[i].operation
          break
        }
      }
    }

    if (
      // check if v-if is the sibling node
      !siblingIf ||
      // check if IfNode is the last operation and get the root IfNode
      !lastIfNode ||
      lastIfNode.type !== IRNodeTypes.IF
    ) {
      context.options.onError(
        createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, node.loc),
      )
      return
    }

    while (lastIfNode.negative && lastIfNode.negative.type === IRNodeTypes.IF) {
      lastIfNode = lastIfNode.negative
    }

    // Check if v-else was followed by v-else-if
    if (dir.name === 'else-if' && lastIfNode.negative) {
      context.options.onError(
        createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, node.loc),
      )
    }

    const comments = context.comment
    if (comments.length) {
      // #3619 ignore comments if the v-if is direct child of <transition>
      if (__DEV__ && !isInTransition(context)) {
        node = wrapTemplate(node, ['else-if', 'else'])
        context.node = node = extend({}, node, {
          children: [...comments, ...node.children],
        })
      }
      comments.length = 0
    }

    const [branch, onExit] = createIfBranch(node, context)

    if (dir.name === 'else') {
      lastIfNode.negative = branch
    } else {
      lastIfNode.negative = {
        type: IRNodeTypes.IF,
        id: -1,
        condition: dir.exp!,
        positive: branch,
        index: context.root.nextIfIndex(),
        blockShape: VaporBlockShape.EMPTY,
        once:
          context.inVOnce ||
          isStaticExpression(dir.exp!, context.options.bindingMetadata),
      }
    }

    return () => {
      onExit()
      if (lastIfNode.negative.type === IRNodeTypes.IF) {
        lastIfNode.negative.blockShape = encodeIfBlockShape(
          lastIfNode.negative.positive,
          forceMultiRoot,
          undefined,
          allowNoScope,
        )
      }
      lastIfNode.blockShape = encodeIfBlockShape(
        lastIfNode.positive,
        forceMultiRoot,
        lastIfNode.negative,
        allowNoScope,
      )
    }
  }
}

export function createIfBranch(
  node: ElementNode,
  context: TransformContext<ElementNode>,
): [BlockIRNode, () => void] {
  context.node = node = wrapTemplate(node, ['if', 'else-if', 'else'])

  const branch: BlockIRNode = newBlock(node)
  const exitBlock = context.enterBlock(branch)
  context.reference()
  return [branch, exitBlock]
}

function encodeIfBlockShape(
  positive: BlockIRNode,
  forceMultiRoot: boolean = false,
  negative?: BlockIRNode | IfIRNode,
  allowNoScope: boolean = true,
): number {
  // Pack the true/false branch shapes into one integer so runtime `createIf()`
  // can decode the selected branch with a single bit-mask operation.
  if (forceMultiRoot) {
    return VaporBlockShape.MULTI_ROOT | (VaporBlockShape.MULTI_ROOT << 2)
  }

  const positiveNoScope = allowNoScope && canSkipIfBranchScope(positive)
  const negativeNoScope =
    allowNoScope &&
    negative &&
    negative.type !== IRNodeTypes.IF &&
    canSkipIfBranchScope(negative)

  return (
    getBlockShape(positive) |
    (getNegativeIfBranchShape(negative) << 2) |
    (positiveNoScope ? VaporIfFlags.TRUE_NO_SCOPE : 0) |
    (negativeNoScope ? VaporIfFlags.FALSE_NO_SCOPE : 0)
  )
}

function getNegativeIfBranchShape(
  negative?: BlockIRNode | IfIRNode,
): VaporBlockShape {
  if (!negative) return VaporBlockShape.EMPTY
  return negative.type === IRNodeTypes.IF
    ? VaporBlockShape.SINGLE_ROOT
    : getBlockShape(negative)
}

function canSkipIfBranchScope(block: BlockIRNode): boolean {
  if (block.effect.length || block.operation.length) {
    return false
  }
  if (!isStaticBranch(block.node)) {
    return false
  }

  if (
    block.returns.length === 0 ||
    block.dynamic.children.length !== block.returns.length
  ) {
    return false
  }

  return block.returns.every(id => {
    const returned = findReturnedDynamic(block, id)
    return !!(
      returned &&
      returned.template != null &&
      !returned.operation &&
      !returned.hasDynamicChild &&
      !(returned.flags & (DynamicFlag.INSERT | DynamicFlag.NON_TEMPLATE))
    )
  })
}

function findReturnedDynamic(
  block: BlockIRNode,
  id: number,
): IRDynamicInfo | undefined {
  return block.dynamic.children.find(child => child.id === id)
}

function isStaticBranch(node: BlockIRNode['node']): boolean {
  if (
    node.type !== NodeTypes.ELEMENT ||
    node.tagType !== ElementTypes.TEMPLATE ||
    node.children.length === 0
  ) {
    return false
  }
  return node.children.every(child => isStaticTemplateNode(child))
}

function isStaticTemplateNode(node: TemplateChildNode): boolean {
  if (node.type === NodeTypes.TEXT || node.type === NodeTypes.COMMENT) {
    return true
  }
  if (
    node.type !== NodeTypes.ELEMENT ||
    node.tagType !== ElementTypes.ELEMENT
  ) {
    return false
  }
  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE || prop.name === 'ref') {
      return false
    }
  }
  return node.children.every(child => isStaticTemplateNode(child))
}

// SSR renders `v-if` inside `<template v-for>` always output <!--[-->...<!--]-->.
// should mark the block as multi-root
function shouldForceMultiRoot(context: TransformContext<ElementNode>): boolean {
  const parent = context.parent && context.parent.node
  return (
    !!parent &&
    parent.type === NodeTypes.ELEMENT &&
    parent.tagType === ElementTypes.TEMPLATE &&
    parent.props.some(
      prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'for',
    )
  )
}
