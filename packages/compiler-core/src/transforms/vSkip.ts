import {
  ElementTypes,
  type IfBranchNode,
  NodeTypes,
  type SimpleExpressionNode,
  type SlotsExpression,
  type TemplateChildNode,
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
    const loc = dir.exp ? dir.exp.loc : node.loc
    if (isTemplateNode(node) || isSlotOutlet(node)) {
      context.onError(createCompilerError(ErrorCodes.X_V_SKIP_ON_TEMPLATE, loc))
      return
    }

    if (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim()) {
      context.onError(
        createCompilerError(ErrorCodes.X_V_SKIP_NO_EXPRESSION, loc),
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
      let children: TemplateChildNode[] = []
      // for components, extract default slot without props
      // if not found, throw an error
      if (node.tagType === ElementTypes.COMPONENT) {
        const codegenNode = node.codegenNode!
        if (codegenNode.type === NodeTypes.VNODE_CALL) {
          const genChildren = codegenNode.children! as SlotsExpression
          if (genChildren.type === NodeTypes.JS_OBJECT_EXPRESSION) {
            const prop = genChildren.properties.find(
              p =>
                p.type === NodeTypes.JS_PROPERTY &&
                p.key.type === NodeTypes.SIMPLE_EXPRESSION &&
                p.key.content === 'default' &&
                p.value.params === undefined,
            )
            if (prop) {
              children = prop.value.returns as TemplateChildNode[]
            } else {
              context.onError(
                createCompilerError(ErrorCodes.X_V_SKIP_UNEXPECTED_SLOT, loc),
              )
            }
          }
        }
      }
      // for plain elements, take all children
      else {
        children = node.children
      }
      const consequent: IfBranchNode = {
        type: NodeTypes.IF_BRANCH,
        loc: node.loc,
        condition: undefined,
        children,
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
