import {
  type BindingMetadata,
  BindingTypes,
  DOMErrorCodes,
  ElementTypes,
  type SimpleExpressionNode,
  createDOMCompilerError,
  createSimpleExpression,
  isStaticPropertyKey,
  walkIdentifiers,
} from '@vue/compiler-dom'
import { escapeHtml, isGloballyAllowed, isVoidTag, makeMap } from '@vue/shared'
import { IRNodeTypes } from '../ir'
import { EMPTY_EXPRESSION } from './utils'
import type { DirectiveTransform } from '../transform'
import { getLiteralExpressionValue, isConstantExpression } from '../utils'
import { markNonTemplate, registerSyntheticTextChild } from './transformText'
import { shouldUseCreateElement } from './transformElement'

const isRawTextContainer = /*@__PURE__*/ makeMap(
  'iframe,noembed,noframes,noscript,script,style,xmp',
)

export const transformVText: DirectiveTransform = (dir, node, context) => {
  let { exp, loc } = dir
  if (!exp) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_NO_EXPRESSION, loc),
    )
    exp = EMPTY_EXPRESSION
  }
  if (node.children.length) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_WITH_CHILDREN, loc),
    )
    context.childrenTemplate.length = 0
    for (const child of node.children) {
      markNonTemplate(child, context)
    }
  }

  // v-text on void tags do nothing
  if (isVoidTag(context.node.tag)) {
    return
  }

  if (node.tagType === ElementTypes.COMPONENT) {
    return {
      key: createSimpleExpression('textContent', true),
      value: exp,
      toDisplayString: !isConstantVTextExpression(
        exp,
        context.options.bindingMetadata,
      ),
    }
  }

  const literal = getLiteralExpressionValue(exp)
  const useCreateElement = shouldUseCreateElement(context.node, context)
  if (literal != null) {
    if (useCreateElement || isRawTextContainer(node.tag)) {
      const id = registerSyntheticTextChild(context, '', [exp])
      context.registerOperation({
        type: IRNodeTypes.INSERT_NODE,
        elements: [id],
        parent: context.reference(),
      })
    } else {
      context.childrenTemplate = [escapeHtml(literal)]
    }
  } else {
    let id: number | undefined
    if (useCreateElement) {
      id = registerSyntheticTextChild(context, '')
      context.registerOperation({
        type: IRNodeTypes.INSERT_NODE,
        elements: [id],
        parent: context.reference(),
      })
    } else {
      context.childrenTemplate = [' ']
      context.registerOperation({
        type: IRNodeTypes.GET_TEXT_CHILD,
        parent: context.reference(),
      })
    }
    context.registerEffect([exp], {
      type: IRNodeTypes.SET_TEXT,
      element: useCreateElement ? id! : context.reference(),
      values: [exp],
      generated: !useCreateElement,
    })
  }
}

// Keep this aligned with the constant classification used by compiler-dom's
// transformExpression + getConstantType path for v-text.
function isConstantVTextExpression(
  exp: SimpleExpressionNode,
  bindings: BindingMetadata,
): boolean {
  if (isConstantExpression(exp)) {
    return true
  }
  if (exp.ast === null) {
    const type = bindings[exp.content]
    return (
      type === BindingTypes.SETUP_CONST || type === BindingTypes.LITERAL_CONST
    )
  }
  if (!exp.ast) {
    return false
  }

  let isConstant = true
  walkIdentifiers(
    exp.ast,
    (id, parent, _parentStack, isReferenced) => {
      if (parent && isStaticPropertyKey(id, parent)) {
        return
      }
      const needsPrefix =
        isReferenced && !isGloballyAllowed(id.name) && id.name !== 'require'
      if (
        needsPrefix ||
        parent?.type === 'CallExpression' ||
        parent?.type === 'NewExpression' ||
        parent?.type === 'MemberExpression'
      ) {
        isConstant = false
      }
    },
    true,
  )
  return isConstant
}
