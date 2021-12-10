import {
  NodeTransform,
  NodeTypes,
  ElementTypes,
  locStub,
  createSimpleExpression,
  RootNode,
  TemplateChildNode,
  ParentNode,
  findDir,
  isBuiltInType
} from '@vue/compiler-dom'

const hasSingleChild = (node: ParentNode): boolean =>
  node.children.filter(n => n.type !== NodeTypes.COMMENT).length === 1

export const ssrInjectFallthroughAttrs: NodeTransform = (node, context) => {
  // _attrs is provided as a function argument.
  // mark it as a known identifier so that it doesn't get prefixed by
  // transformExpression.
  if (node.type === NodeTypes.ROOT) {
    context.identifiers._attrs = 1
  }

  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.COMPONENT &&
    (isBuiltInType(node.tag, 'Transition') ||
      isBuiltInType(node.tag, 'KeepAlive'))
  ) {
    if (hasSingleChild(node)) {
      injectFallthroughAttrs(node.children[0])
    }
    return
  }

  const parent = context.parent
  if (!parent || parent.type !== NodeTypes.ROOT) {
    return
  }

  if (node.type === NodeTypes.IF_BRANCH && hasSingleChild(node)) {
    injectFallthroughAttrs(node.children[0])
  } else if (hasSingleChild(parent)) {
    injectFallthroughAttrs(node)
  }
}

function injectFallthroughAttrs(node: RootNode | TemplateChildNode) {
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
      exp: createSimpleExpression(`_attrs`, false),
      modifiers: [],
      loc: locStub
    })
  }
}
