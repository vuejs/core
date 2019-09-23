import {
  createStructuralDirectiveTransform,
  traverseChildren
} from '../transform'
import {
  NodeTypes,
  ElementTypes,
  ElementNode,
  DirectiveNode,
  IfBranchNode
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'

export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    if (dir.name === 'if') {
      context.replaceNode({
        type: NodeTypes.IF,
        loc: node.loc,
        branches: [createIfBranch(node, dir)]
      })
    } else {
      // locate the adjacent v-if
      const siblings = context.parent.children
      const comments = []
      let i = siblings.indexOf(node)
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
