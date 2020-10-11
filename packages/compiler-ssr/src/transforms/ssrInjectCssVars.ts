import {
  NodeTransform,
  NodeTypes,
  ElementTypes,
  locStub,
  createSimpleExpression,
  RootNode,
  TemplateChildNode,
  findDir
} from '@vue/compiler-dom'
import { SSR_RESOLVE_CSS_VARS } from '../runtimeHelpers'

export const ssrInjectCssVars: NodeTransform = (node, context) => {
  if (!context.ssrCssVars) {
    return
  }

  // _cssVars is initialized once per render function
  // the code is injected in ssrCodegenTransform when creating the
  // ssr transform context
  if (node.type === NodeTypes.ROOT) {
    context.identifiers._cssVars = 1
  }

  const parent = context.parent
  if (!parent || parent.type !== NodeTypes.ROOT) {
    return
  }

  context.helper(SSR_RESOLVE_CSS_VARS)

  if (node.type === NodeTypes.IF_BRANCH) {
    for (const child of node.children) {
      injectCssVars(child)
    }
  } else {
    injectCssVars(node)
  }
}

function injectCssVars(node: RootNode | TemplateChildNode) {
  if (
    node.type === NodeTypes.ELEMENT &&
    (node.tagType === ElementTypes.ELEMENT ||
      node.tagType === ElementTypes.COMPONENT) &&
    !findDir(node, 'for')
  ) {
    node.props.push({
      type: NodeTypes.DIRECTIVE,
      name: 'bind',
      arg: undefined,
      exp: createSimpleExpression(`_cssVars`, false),
      modifiers: [],
      loc: locStub
    })
  }
}
