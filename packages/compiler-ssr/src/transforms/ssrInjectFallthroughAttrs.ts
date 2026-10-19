import {
  ElementTypes,
  type IfBranchNode,
  type NodeTransform,
  NodeTypes,
  type ParentNode,
  type RootNode,
  type TemplateChildNode,
  createSimpleExpression,
  findDir,
  isCommentOrWhitespace,
  isWhitespaceText,
  locStub,
} from '@vue/compiler-dom'

const filterChild = (node: ParentNode) =>
  node.children.filter(n => !isCommentOrWhitespace(n))

const hasSingleChild = (node: ParentNode): boolean =>
  filterChild(node).length === 1

// whether the nodes are a single v-if chain, e.g. a v-if + v-else pair
function isSingleIfChain(nodes: TemplateChildNode[]): boolean {
  let hasEncounteredIf = false
  for (const c of nodes) {
    if (
      c.type === NodeTypes.IF ||
      (c.type === NodeTypes.ELEMENT && findDir(c, 'if'))
    ) {
      // multiple v-if
      if (hasEncounteredIf) return false
      hasEncounteredIf = true
    } else if (
      // node before v-if
      !hasEncounteredIf ||
      // non else nodes
      !(c.type === NodeTypes.ELEMENT && findDir(c, /else/, true))
    ) {
      return false
    }
  }
  return hasEncounteredIf
}

// root v-if branches whose only content is a nested v-if chain, which then
// renders the root in their place
const rootIfBranches = new WeakSet<IfBranchNode>()

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
  if (
    !parent ||
    (parent.type !== NodeTypes.ROOT &&
      !(parent.type === NodeTypes.IF_BRANCH && rootIfBranches.has(parent)))
  ) {
    return
  }

  if (node.type === NodeTypes.IF_BRANCH) {
    // detect cases where the parent v-if is not the only root level node
    if (!isSingleIfChain(filterChild(parent))) return
    // whitespace kept next to a comment at the edges of the branch (with
    // whitespace: 'preserve') makes the client render a fragment root, unlike
    // whitespace between v-if/v-else siblings, which v-if removes
    const content = node.children.filter(c => c.type !== NodeTypes.COMMENT)
    if (
      content.length &&
      (isWhitespaceText(content[0]) ||
        isWhitespaceText(content[content.length - 1]))
    ) {
      return
    }
    const children = filterChild(node)
    if (children.length === 1) {
      injectFallthroughAttrs(children[0])
    } else if (isSingleIfChain(children)) {
      rootIfBranches.add(node)
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
