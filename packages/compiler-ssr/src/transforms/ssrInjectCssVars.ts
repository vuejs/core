import {
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type RootNode,
  type SlotOutletNode,
  type TemplateChildNode,
  createSimpleExpression,
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
      injectCssVars(child)
    }
  } else {
    injectCssVars(node)
  }
}

// Builtins that render their children without an element of their own, so
// props bound to them never reach the output and css vars have to be injected
// into the children instead.
const isTransparentBuiltin = (tag: string): boolean =>
  tag === 'suspense' ||
  tag === 'Suspense' ||
  tag === 'keep-alive' ||
  tag === 'KeepAlive' ||
  tag === 'teleport' ||
  tag === 'Teleport'

// `<slot>` has no element of its own: the passed content (and the fallback)
// is the root, so it has to carry the vars the same way an element root does.
const slotsWithCssVars = new WeakSet<SlotOutletNode>()

export function slotNeedsCssVars(node: SlotOutletNode): boolean {
  return slotsWithCssVars.has(node)
}

function injectCssVars(node: RootNode | TemplateChildNode) {
  if (
    node.type === NodeTypes.ELEMENT &&
    (node.tagType === ElementTypes.TEMPLATE ||
      node.tagType === ElementTypes.SLOT)
  ) {
    if (node.tagType === ElementTypes.SLOT) {
      slotsWithCssVars.add(node)
    }
    node.children.forEach(injectCssVars)
    return
  }

  if (
    node.type === NodeTypes.ELEMENT &&
    (node.tagType === ElementTypes.ELEMENT ||
      node.tagType === ElementTypes.COMPONENT)
  ) {
    if (isTransparentBuiltin(node.tag)) {
      for (const child of node.children) {
        if (
          child.type === NodeTypes.ELEMENT &&
          child.tagType === ElementTypes.TEMPLATE
        ) {
          // slot content
          child.children.forEach(injectCssVars)
        } else {
          injectCssVars(child)
        }
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
