import { NodeTransform } from '../transform'
import {
  NodeTypes,
  CompoundExpressionNode,
  createCallExpression,
  CallExpression,
  ElementTypes,
  ConstantTypes,
  createCompoundExpression
} from '../ast'
import { isText } from '../utils'
import { CREATE_TEXT } from '../runtimeHelpers'
import { PatchFlags, PatchFlagNames } from '@vue/shared'
import { getConstantType } from './hoistStatic'

// Merge adjacent text nodes and expressions into a single expression
// e.g. <div>abc {{ d }} {{ e }}</div> should have a single expression node as child.
export const transformText: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    // perform the transform on node exit so that all expressions have already
    // been processed.
    return () => {
      const children = node.children
      let currentContainer: CompoundExpressionNode | undefined = undefined
      let hasText = false

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          hasText = true
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = createCompoundExpression(
                  [child],
                  child.loc
                )
              }
              // merge adjacent text node into current
              currentContainer.children.push(` + `, next)
              children.splice(j, 1)
              j--
            } else {
              currentContainer = undefined
              break
            }
          }
        }
      }

      if (
        !hasText ||
        // if this is a plain element with a single text child, leave it
        // as-is since the runtime has dedicated fast path for this by directly
        // setting textContent of the element.
        // for component root it's always normalized anyway.
        (children.length === 1 &&
          (node.type === NodeTypes.ROOT ||
            (node.type === NodeTypes.ELEMENT &&
              node.tagType === ElementTypes.ELEMENT &&
              // #3756
              // custom directives can potentially add DOM elements arbitrarily,
              // we need to avoid setting textContent of the element at runtime
              // to avoid accidentally overwriting the DOM elements added
              // by the user through custom directives.
              !node.props.find(
                p =>
                  p.type === NodeTypes.DIRECTIVE &&
                  !context.directiveTransforms[p.name]
              ) &&
              // in compat mode, <template> tags with no special directives
              // will be rendered as a fragment so its children must be
              // converted into vnodes.
              !(__COMPAT__ && node.tag === 'template'))))
      ) {
        return
      }

      // pre-convert text nodes into createTextVNode(text) calls to avoid
      // runtime normalization.
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
          const callArgs: CallExpression['arguments'] = []
          // createTextVNode defaults to single whitespace, so if it is a
          // single space the code could be an empty call to save bytes.
          if (child.type !== NodeTypes.TEXT || child.content !== ' ') {
            callArgs.push(child)
          }
          // mark dynamic text with flag so it gets patched inside a block
          if (
            !context.ssr &&
            getConstantType(child, context) === ConstantTypes.NOT_CONSTANT
          ) {
            callArgs.push(
              PatchFlags.TEXT +
                (__DEV__ ? ` /* ${PatchFlagNames[PatchFlags.TEXT]} */` : ``)
            )
          }
          children[i] = {
            type: NodeTypes.TEXT_CALL,
            content: child,
            loc: child.loc,
            codegenNode: createCallExpression(
              context.helper(CREATE_TEXT),
              callArgs
            )
          }
        }
      }
    }
  }
}
