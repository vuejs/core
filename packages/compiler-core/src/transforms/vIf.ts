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
  JSChildNode,
  ObjectExpression,
  createObjectProperty,
  Property
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { processExpression } from './transformExpression'
import {
  OPEN_BLOCK,
  CREATE_BLOCK,
  EMPTY,
  FRAGMENT,
  APPLY_DIRECTIVES
} from '../runtimeConstants'
import { isString } from '@vue/shared'

export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    if (
      dir.name !== 'else' &&
      (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim())
    ) {
      const loc = dir.exp ? dir.exp.loc : node.loc
      context.onError(createCompilerError(ErrorCodes.X_IF_NO_EXPRESSION, loc))
      dir.exp = createSimpleExpression(`true`, false, loc)
    }

    if (!__BROWSER__ && context.prefixIdentifiers && dir.exp) {
      // dir.exp can only be simple expression because vIf transform is applied
      // before expression transform.
      dir.exp = processExpression(dir.exp as SimpleExpressionNode, context)
    }

    if (dir.name === 'if') {
      const codegenNode = createSequenceExpression([
        createCallExpression(context.helper(OPEN_BLOCK))
      ])

      context.replaceNode({
        type: NodeTypes.IF,
        loc: node.loc,
        branches: [createIfBranch(node, dir)],
        codegenNode
      })

      // Exit callback. Complete the codegenNode when all children have been
      // transformed.
      return () => {
        codegenNode.expressions.push(
          createCodegenNodeForBranch(node, dir, 0, context)
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
                node,
                dir,
                sibling.branches.length - 1,
                context
              )
              break
            }
          }
        } else {
          context.onError(
            createCompilerError(
              dir.name === 'else'
                ? ErrorCodes.X_ELSE_NO_ADJACENT_IF
                : ErrorCodes.X_ELSE_IF_NO_ADJACENT_IF,
              node.loc
            )
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
  node: ElementNode,
  dir: DirectiveNode,
  index: number,
  context: TransformContext
): ConditionalExpression | CallExpression {
  if (dir.exp) {
    return createConditionalExpression(
      dir.exp,
      createChildrenCodegenNode(node, index, context),
      createCallExpression(context.helper(CREATE_BLOCK), [
        context.helper(EMPTY)
      ])
    )
  } else {
    return createChildrenCodegenNode(node, index, context)
  }
}

function createChildrenCodegenNode(
  node: ElementNode,
  index: number,
  { helper }: TransformContext
): CallExpression {
  const isTemplate = node.tagType === ElementTypes.TEMPLATE
  const keyExp = `{ key: ${index} }`
  if (isTemplate) {
    return createCallExpression(helper(CREATE_BLOCK), [
      helper(FRAGMENT),
      keyExp,
      node.children
    ])
  } else {
    let childCodegen = node.codegenNode!
    if (childCodegen.callee === helper(APPLY_DIRECTIVES)) {
      childCodegen = childCodegen.arguments[0] as CallExpression
    }
    // change child to a block
    childCodegen.callee = helper(CREATE_BLOCK)
    // branch key
    const existingProps = childCodegen.arguments[1]
    if (!existingProps || existingProps === `null`) {
      childCodegen.arguments[1] = keyExp
    } else {
      // inject branch key if not already have a key
      const props = existingProps as CallExpression | ObjectExpression
      if (props.type === NodeTypes.JS_CALL_EXPRESSION) {
        // merged props... add ours
        // only inject key to object literal if it's the first argument so that
        // if doesn't override user provided keys
        const first = props.arguments[0] as string | JSChildNode
        if (!isString(first) && first.type === NodeTypes.JS_OBJECT_EXPRESSION) {
          first.properties.unshift(createKeyProperty(index))
        } else {
          props.arguments.unshift(keyExp)
        }
      } else {
        props.properties.unshift(createKeyProperty(index))
      }
    }
    return childCodegen
  }
}

function createKeyProperty(index: number): Property {
  return createObjectProperty(
    createSimpleExpression(`key`, true),
    createSimpleExpression(index + '', false)
  )
}
