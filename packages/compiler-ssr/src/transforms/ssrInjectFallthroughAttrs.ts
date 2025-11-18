import {
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type RootNode,
  type TemplateChildNode,
  createSimpleExpression,
  filterNonCommentChildren,
  findDir,
  hasSingleChild,
  isSingleIfBlock,
  locStub,
} from '@vue/compiler-dom'

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
    (node.tag === 'transition' ||
      node.tag === 'Transition' ||
      node.tag === 'KeepAlive' ||
      node.tag === 'keep-alive')
  ) {
    const rootChildren = filterNonCommentChildren(context.root)
    if (rootChildren.length === 1 && rootChildren[0] === node) {
      if (hasSingleChild(node)) {
        injectFallthroughAttrs(node.children[0])
      }
      return
    }
  }

  const parent = context.parent
  if (!parent || parent.type !== NodeTypes.ROOT) {
    return
  }

  if (node.type === NodeTypes.IF_BRANCH && hasSingleChild(node)) {
    if (isSingleIfBlock(parent)) {
      injectFallthroughAttrs(node.children[0])
    }
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
      loc: locStub,
    })
  }
}
