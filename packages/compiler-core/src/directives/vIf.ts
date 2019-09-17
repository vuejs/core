import { createDirectiveTransform } from '../transform'
import {
  NodeTypes,
  ElementTypes,
  ElementNode,
  DirectiveNode,
  IfBranchNode
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'

export const transformIf = createDirectiveTransform(
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
      let i = context.childIndex
      while (i--) {
        const sibling = siblings[i]
        if (sibling.type === NodeTypes.COMMENT) {
          continue
        }
        if (sibling.type === NodeTypes.IF) {
          // move the node to the if node's branches
          context.removeNode()
          sibling.branches.push(createIfBranch(node, dir))
        } else {
          context.onError(
            createCompilerError(
              dir.name === 'else'
                ? ErrorCodes.X_ELSE_NO_ADJACENT_IF
                : ErrorCodes.X_ELSE_IF_NO_ADJACENT_IF,
              node.loc.start
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
