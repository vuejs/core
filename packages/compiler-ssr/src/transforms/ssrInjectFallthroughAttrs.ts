import {
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type ParentNode,
  type RootNode,
  type TemplateChildNode,
  createSimpleExpression,
  findDir,
  locStub,
} from '@vue/compiler-dom'

const filterChild = (node: ParentNode) =>
  node.children.filter(
    n => n.type !== NodeTypes.COMMENT && n.type !== NodeTypes.TEXT,
  )

const hasSingleChild = (node: ParentNode): boolean =>
  filterChild(node).length === 1

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
    const rootChildren = filterChild(context.root)
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
    // detect cases where the parent v-if is not the only root level node
    let hasEncounteredIf = false
    for (const c of filterChild(parent)) {
      if (
        c.type === NodeTypes.IF ||
        (c.type === NodeTypes.ELEMENT && findDir(c, 'if'))
      ) {
        // multiple root v-if
        if (hasEncounteredIf) return
        hasEncounteredIf = true
      } else if (
        // node before v-if
        !hasEncounteredIf ||
        // non else nodes
        !(c.type === NodeTypes.ELEMENT && findDir(c, /else/, true))
      ) {
        return
      }
    }
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
      loc: locStub,
    })
  }
}
