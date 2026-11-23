import {
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type RootNode,
  TRANSITION,
  type TemplateChildNode,
  type TransformContext,
  createSimpleExpression,
  isCoreComponent,
  locStub,
} from '@vue/compiler-dom'

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

  if (node.type === NodeTypes.IF_BRANCH || node.type === NodeTypes.FOR) {
    for (const child of node.children) {
      injectCssVars(child, context)
    }
  } else {
    injectCssVars(node, context)
  }
}

// Builtins that render their children without an element of their own, so
// props bound to them never reach the output and css vars have to be injected
// into the children instead.
const isTransparentBuiltin = (
  tag: string,
  context: TransformContext,
): boolean =>
  !!isCoreComponent(tag) || context.isBuiltInComponent(tag) === TRANSITION

function injectCssVars(
  node: RootNode | TemplateChildNode,
  context: TransformContext,
) {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.TEMPLATE
  ) {
    for (const child of node.children) {
      injectCssVars(child, context)
    }
    return
  }

  if (
    node.type === NodeTypes.ELEMENT &&
    (node.tagType === ElementTypes.ELEMENT ||
      node.tagType === ElementTypes.COMPONENT)
  ) {
    if (isTransparentBuiltin(node.tag, context)) {
      for (const child of node.children) {
        injectCssVars(child, context)
      }
    } else {
      node.props.push({
        type: NodeTypes.DIRECTIVE,
        name: 'bind',
        arg: undefined,
        exp: createSimpleExpression(`_cssVars`, false),
        modifiers: [],
        loc: locStub,
      })
    }
  }
}
