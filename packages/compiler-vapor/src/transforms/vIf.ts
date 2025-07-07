import {
  type ElementNode,
  ErrorCodes,
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
  IRNodeTypes,
  type VaporDirectiveNode,
} from '../ir'
import { extend } from '@vue/shared'
import { newBlock, wrapTemplate } from './utils'
import { getSiblingIf } from './transformComment'
import { isStaticExpression } from '../utils'

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
  if (dir.name === 'if') {
    const id = context.reference()
    context.dynamic.flags |= DynamicFlag.INSERT
    const [branch, onExit] = createIfBranch(node, context)

    return () => {
      onExit()
      context.dynamic.operation = {
        type: IRNodeTypes.IF,
        id,
        condition: dir.exp!,
        positive: branch,
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

    // TODO ignore comments if the v-if is direct child of <transition> (PR #3622)
    if (__DEV__ && context.root.comment.length) {
      node = wrapTemplate(node, ['else-if', 'else'])
      context.node = node = extend({}, node, {
        children: [...context.comment, ...node.children],
      })
    }
    context.root.comment = []

    const [branch, onExit] = createIfBranch(node, context)

    if (dir.name === 'else') {
      lastIfNode.negative = branch
    } else {
      lastIfNode.negative = {
        type: IRNodeTypes.IF,
        id: -1,
        condition: dir.exp!,
        positive: branch,
        once: context.inVOnce,
      }
    }

    return () => onExit()
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
