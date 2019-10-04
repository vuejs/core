import {
  createStructuralDirectiveTransform,
  traverseChildren,
  TransformContext
} from '../transform'
import {
  NodeTypes,
  ElementTypes,
  ElementNode,
  DirectiveNode,
  IfBranchNode,
  SimpleExpressionNode,
  createSequenceExpression,
  createCallExpression,
  createConditionalExpression,
  ConditionalExpression,
  CallExpression,
  createSimpleExpression,
  createObjectProperty,
  createObjectExpression
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { processExpression } from './transformExpression'
import {
  OPEN_BLOCK,
  CREATE_BLOCK,
  EMPTY,
  FRAGMENT,
  APPLY_DIRECTIVES,
  CREATE_VNODE,
  RENDER_SLOT
} from '../runtimeConstants'
import { injectProp } from '../utils'
import { PropsExpression } from './transformElement'

export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    if (
      dir.name !== 'else' &&
      (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim())
    ) {
      const loc = dir.exp ? dir.exp.loc : node.loc
      context.onError(
        createCompilerError(ErrorCodes.X_IF_NO_EXPRESSION, dir.loc)
      )
      dir.exp = createSimpleExpression(`true`, false, loc)
    }

    if (!__BROWSER__ && context.prefixIdentifiers && dir.exp) {
      // dir.exp can only be simple expression because vIf transform is applied
      // before expression transform.
      dir.exp = processExpression(dir.exp as SimpleExpressionNode, context)
    }

    if (dir.name === 'if') {
      const branch = createIfBranch(node, dir)
      const codegenNode = createSequenceExpression([
        createCallExpression(context.helper(OPEN_BLOCK))
      ])
      context.replaceNode({
        type: NodeTypes.IF,
        loc: node.loc,
        branches: [branch],
        codegenNode
      })

      // Exit callback. Complete the codegenNode when all children have been
      // transformed.
      return () => {
        codegenNode.expressions.push(
          createCodegenNodeForBranch(branch, 0, context)
        )
      }
    } else {
      // locate the adjacent v-if
      const siblings = context.parent!.children
      const comments = []
      let i = siblings.indexOf(node as any)
      while (i-- >= -1) {
        const sibling = siblings[i]
        if (__DEV__ && sibling && sibling.type === NodeTypes.COMMENT) {
          context.removeNode(sibling)
          comments.unshift(sibling)
          continue
        }
        if (sibling && sibling.type === NodeTypes.IF) {
          // move the node to the if node's branches
          context.removeNode()
          const branch = createIfBranch(node, dir)
          if (__DEV__ && comments.length) {
            branch.children = [...comments, ...branch.children]
          }
          sibling.branches.push(branch)
          // since the branch was removed, it will not be traversed.
          // make sure to traverse here.
          traverseChildren(branch, context)
          // attach this branch's codegen node to the v-if root.
          let parentCondition = sibling.codegenNode
            .expressions[1] as ConditionalExpression
          while (true) {
            if (
              parentCondition.alternate.type ===
              NodeTypes.JS_CONDITIONAL_EXPRESSION
            ) {
              parentCondition = parentCondition.alternate
            } else {
              parentCondition.alternate = createCodegenNodeForBranch(
                branch,
                sibling.branches.length - 1,
                context
              )
              break
            }
          }
        } else {
          context.onError(
            createCompilerError(ErrorCodes.X_ELSE_NO_ADJACENT_IF, node.loc)
          )
        }
        break
      }
    }
  }
)

function createIfBranch(node: ElementNode, dir: DirectiveNode): IfBranchNode {
  return {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: dir.name === 'else' ? undefined : dir.exp,
    children: node.tagType === ElementTypes.TEMPLATE ? node.children : [node]
  }
}

function createCodegenNodeForBranch(
  branch: IfBranchNode,
  index: number,
  context: TransformContext
): ConditionalExpression | CallExpression {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, index, context),
      createCallExpression(context.helper(CREATE_BLOCK), [
        context.helper(EMPTY)
      ])
    )
  } else {
    return createChildrenCodegenNode(branch, index, context)
  }
}

function createChildrenCodegenNode(
  branch: IfBranchNode,
  index: number,
  context: TransformContext
): CallExpression {
  const { helper } = context
  const keyProperty = createObjectProperty(
    `key`,
    createSimpleExpression(index + '', false)
  )
  const { children } = branch
  const child = children[0]
  const needFragmentWrapper =
    children.length !== 1 || child.type !== NodeTypes.ELEMENT
  if (needFragmentWrapper) {
    const blockArgs: CallExpression['arguments'] = [
      helper(FRAGMENT),
      createObjectExpression([keyProperty]),
      children
    ]
    if (children.length === 1 && child.type === NodeTypes.FOR) {
      // optimize away nested fragments when child is a ForNode
      const forBlockArgs = (child.codegenNode.expressions[1] as CallExpression)
        .arguments
      // directly use the for block's children and patchFlag
      blockArgs[2] = forBlockArgs[2]
      blockArgs[3] = forBlockArgs[3]
    }
    return createCallExpression(helper(CREATE_BLOCK), blockArgs)
  } else {
    const childCodegen = (child as ElementNode).codegenNode as CallExpression
    let vnodeCall = childCodegen
    // Element with custom directives. Locate the actual createVNode() call.
    if (vnodeCall.callee.includes(APPLY_DIRECTIVES)) {
      vnodeCall = vnodeCall.arguments[0] as CallExpression
    }
    // Change createVNode to createBlock.
    if (vnodeCall.callee.includes(CREATE_VNODE)) {
      vnodeCall.callee = helper(CREATE_BLOCK)
    }
    // It's possible to have renderSlot() here as well - which already produces
    // a block, so no need to change the callee. However it accepts props at
    // a different arg index so make sure to check for so that the key injection
    // logic below works for it too.
    const propsIndex = vnodeCall.callee.includes(RENDER_SLOT) ? 2 : 1
    // inject branch key
    const existingProps = vnodeCall.arguments[propsIndex] as
      | PropsExpression
      | undefined
      | 'null'
    vnodeCall.arguments[propsIndex] = injectProp(
      existingProps,
      keyProperty,
      context
    )
    return childCodegen
  }
}
