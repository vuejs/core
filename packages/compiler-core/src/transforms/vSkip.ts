import {
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type IfBranchNode,
  NodeTypes,
  type SimpleExpressionNode,
  type SkipNode,
  type TemplateChildNode,
  createCallExpression,
  createConditionalExpression,
  createSimpleExpression,
} from '../ast'
import {
  type NodeTransform,
  type TransformContext,
  createStructuralDirectiveTransform,
} from '../transform'
import {
  CREATE_COMMENT,
  ErrorCodes,
  buildSlots,
  createCompilerError,
  findDir,
  findProp,
  isSlotOutlet,
  processExpression,
} from '@vue/compiler-core'
import { createCodegenNodeForBranch } from './vIf'
import { validateBrowserExpression } from '../validateExpression'
import { cloneLoc } from '../parser'

export const transformSkip: NodeTransform = createStructuralDirectiveTransform(
  'skip',
  (node, dir, context) => {
    return processSkip(node, dir, context, skipNode => {
      return () => {
        const { consequent, alternate, test } = skipNode
        const consequentNode =
          consequent.type === NodeTypes.IF_BRANCH
            ? createCodegenNodeForBranch(consequent, 0, context)
            : consequent

        skipNode.codegenNode = createConditionalExpression(
          test,
          consequentNode,
          createCodegenNodeForBranch(alternate, 1, context),
        )
      }
    })
  },
)

export function processSkip(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (skipNode: SkipNode) => () => void,
): (() => void) | undefined {
  const loc = dir.exp ? dir.exp.loc : node.loc
  if (
    (node.type === NodeTypes.ELEMENT && node.tag === 'template') ||
    isSlotOutlet(node)
  ) {
    context.onError(createCompilerError(ErrorCodes.X_V_SKIP_ON_TEMPLATE, loc))
    return
  }

  if (findDir(node, 'for')) {
    context.onError(createCompilerError(ErrorCodes.X_V_SKIP_WITH_V_FOR, loc))
  }

  if (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim()) {
    context.onError(createCompilerError(ErrorCodes.X_V_SKIP_NO_EXPRESSION, loc))
    dir.exp = createSimpleExpression(`true`, false, loc)
  }

  if (!__BROWSER__ && context.prefixIdentifiers && dir.exp) {
    dir.exp = processExpression(dir.exp as SimpleExpressionNode, context)
  }

  if (__DEV__ && __BROWSER__ && dir.exp) {
    validateBrowserExpression(dir.exp as SimpleExpressionNode, context)
  }

  let children: TemplateChildNode[] = []
  // for components, extract default slot without props
  // if not found, throw an error
  if (node.tagType === ElementTypes.COMPONENT) {
    const { slots } = buildSlots(node, context, undefined, true)
    if (slots.type === NodeTypes.JS_OBJECT_EXPRESSION) {
      const prop = slots.properties.find(
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
  // for plain elements, take all children
  else {
    children = node.children
  }

  // if children is empty, create comment node
  const consequent =
    children.length !== 0
      ? ({
          type: NodeTypes.IF_BRANCH,
          loc: node.loc,
          condition: undefined,
          children,
          userKey: findProp(node, `key`),
        } as IfBranchNode)
      : createCallExpression(context.helper(CREATE_COMMENT), [
          __DEV__ ? '"v-skip"' : '""',
          'true',
        ])

  const alternate: IfBranchNode = {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: undefined,
    children: [node],
    userKey: findProp(node, `key`),
  }

  const skipNode: SkipNode = {
    type: NodeTypes.SKIP,
    loc: cloneLoc(node.loc),
    test: dir.exp,
    consequent,
    alternate,
    newline: true,
  }
  context.replaceNode(skipNode)
  if (processCodegen) return processCodegen(skipNode)
}
