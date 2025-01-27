import {
  type ComponentNode,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type ExpressionNode,
  type IfBranchNode,
  NodeTypes,
  type SimpleExpressionNode,
  type SkipNode,
  type SourceLocation,
  type TemplateChildNode,
  type VNodeCall,
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
  RESOLVE_SKIP_COMPONENT,
  WITH_MEMO,
  buildSlots,
  createCompilerError,
  findDir,
  findProp,
  processExpression,
} from '@vue/compiler-core'
import { createCodegenNodeForBranch } from './vIf'
import { validateBrowserExpression } from '../validateExpression'
import { cloneLoc } from '../parser'
import { clone } from '@vue/shared'

export const transformSkip: NodeTransform = createStructuralDirectiveTransform(
  'skip',
  (node, dir, context) => {
    return processSkip(node, dir, context, (skipNode?: SkipNode) => {
      return () => {
        const codegenNode = node.codegenNode!
        if (!skipNode) {
          if (codegenNode.type === NodeTypes.VNODE_CALL) {
            codegenNode.tag = getVNodeTag(
              context,
              dir.exp!,
              codegenNode.tag as string,
            )
          } else if (
            codegenNode.type === NodeTypes.JS_CALL_EXPRESSION &&
            codegenNode.callee === WITH_MEMO
          ) {
            const vnodeCall = codegenNode.arguments[1].returns as VNodeCall
            vnodeCall.tag = getVNodeTag(
              context,
              dir.exp!,
              vnodeCall.tag as string,
            )
          }
        } else {
          const { consequent, alternate, test } = skipNode!
          skipNode!.codegenNode = createConditionalExpression(
            test,
            consequent.type === NodeTypes.IF_BRANCH
              ? createCodegenNodeForBranch(consequent, 0, context)
              : consequent,
            createCodegenNodeForBranch(alternate, 1, context),
          )
        }
      }
    })
  },
)

export function processSkip(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (skipNode?: SkipNode) => () => void,
): (() => void) | undefined {
  const loc = dir.exp ? dir.exp.loc : node.loc
  if (
    // v-skip is not allowed on <template> or <slot>
    !(
      node.type === NodeTypes.ELEMENT &&
      (node.tagType === ElementTypes.ELEMENT ||
        node.tagType === ElementTypes.COMPONENT) &&
      node.tag !== 'template' &&
      node.tag !== 'slot'
    )
  ) {
    context.onError(createCompilerError(ErrorCodes.X_V_SKIP_MISPLACED, loc))
    return
  }

  if (findDir(node, 'for')) {
    context.onError(createCompilerError(ErrorCodes.X_V_SKIP_WITH_V_FOR, loc))
    return
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

  // element will be processed as a skip node
  // - native element
  // - teleport, since it has children
  // - component without dynamic slots
  let processAsSkipNode = false
  const isComponent = node.tagType === ElementTypes.COMPONENT
  let children: TemplateChildNode[] = []
  if (
    node.tagType === ElementTypes.ELEMENT ||
    (isComponent && node.tag === 'Teleport')
  ) {
    processAsSkipNode = true
    children = node.children
  } else if (isComponent) {
    const { hasDynamicSlots, defaultSlot } = resolveDefaultSlot(node, context)
    if (!hasDynamicSlots) {
      if (defaultSlot) {
        processAsSkipNode = true
        // using the cloned node for ssr VNode-based slot
        children = context.inSSR ? clone(defaultSlot) : defaultSlot
      } else {
        context.onError(
          createCompilerError(ErrorCodes.X_V_SKIP_UNEXPECTED_SLOT, loc),
        )
      }
    }
  }

  let skipNode: SkipNode | undefined
  if (processAsSkipNode) {
    // if children is empty, create comment node
    const consequent =
      children.length !== 0
        ? createBranchNode(node, node.loc, children)
        : createCallExpression(context.helper(CREATE_COMMENT), [
            __DEV__ ? '"v-skip"' : '""',
            'true',
          ])

    skipNode = {
      type: NodeTypes.SKIP,
      loc: cloneLoc(node.loc),
      test: dir.exp,
      consequent,
      alternate: createBranchNode(node, node.loc, [node]),
      newline: true,
      codegenNode: undefined,
    }

    context.replaceNode(skipNode)
  }

  if (processCodegen) return processCodegen(skipNode)
}

function resolveDefaultSlot(node: ComponentNode, context: TransformContext) {
  let defaultSlot: TemplateChildNode[] | undefined = undefined
  const { slots, hasDynamicSlots } = buildSlots(node, context, undefined, true)
  // find default slot without slot props if not has dynamic slots
  if (!hasDynamicSlots && slots.type === NodeTypes.JS_OBJECT_EXPRESSION) {
    const prop = slots.properties.find(
      p =>
        p.type === NodeTypes.JS_PROPERTY &&
        p.key.type === NodeTypes.SIMPLE_EXPRESSION &&
        p.key.content === 'default' &&
        p.value.params === undefined,
    )
    if (prop) {
      defaultSlot = prop.value.returns as TemplateChildNode[]
    }
  }
  return { hasDynamicSlots, defaultSlot }
}

function createBranchNode(
  node: ElementNode,
  loc: SourceLocation,
  children: TemplateChildNode[],
): IfBranchNode {
  return {
    type: NodeTypes.IF_BRANCH,
    loc,
    condition: undefined,
    children,
    userKey: findProp(node, `key`),
  }
}

function getVNodeTag(
  context: TransformContext,
  exp: ExpressionNode,
  tag: string,
) {
  return createCallExpression(context.helper(RESOLVE_SKIP_COMPONENT), [
    exp,
    tag,
  ])
}
