import {
  type IfBranchNode,
  NodeTypes,
  type SimpleExpressionNode,
  createConditionalExpression,
  createSimpleExpression,
} from '../ast'
import {
  type NodeTransform,
  createStructuralDirectiveTransform,
} from '../transform'
import {
  ErrorCodes,
  createCompilerError,
  findProp,
  isSlotOutlet,
  isTemplateNode,
  processExpression,
} from '@vue/compiler-core'
import { createCodegenNodeForBranch } from './vIf'
import { validateBrowserExpression } from '../validateExpression'

export const transformSkip: NodeTransform = createStructuralDirectiveTransform(
  'skip',
  (node, dir, context) => {
    if (isTemplateNode(node) || isSlotOutlet(node)) {
      const loc = dir.exp ? dir.exp.loc : node.loc
      context.onError(createCompilerError(ErrorCodes.X_V_SKIP_ON_TEMPLATE, loc))
      return
    }

    if (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim()) {
      const loc = dir.exp ? dir.exp.loc : node.loc
      context.onError(
        createCompilerError(ErrorCodes.X_V_SKIP_NO_EXPRESSION, dir.loc),
      )
      dir.exp = createSimpleExpression(`true`, false, loc)
    }

    if (!__BROWSER__ && context.prefixIdentifiers && dir.exp) {
      dir.exp = processExpression(dir.exp as SimpleExpressionNode, context)
    }

    if (__DEV__ && __BROWSER__ && dir.exp) {
      validateBrowserExpression(dir.exp as SimpleExpressionNode, context)
    }

    return () => {
      const consequent: IfBranchNode = {
        type: NodeTypes.IF_BRANCH,
        loc: node.loc,
        condition: undefined,
        children: node.children,
        userKey: findProp(node, `key`),
      }
      const alternate: IfBranchNode = {
        type: NodeTypes.IF_BRANCH,
        loc: node.loc,
        condition: undefined,
        children: [node],
        userKey: findProp(node, `key`),
      }
      node.codegenNode = createConditionalExpression(
        dir.exp!,
        createCodegenNodeForBranch(consequent, 0, context),
        createCodegenNodeForBranch(alternate, 1, context),
      )
    }
  },
)
