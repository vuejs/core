import {
  RootNode,
  NodeTypes,
  ParentNode,
  ChildNode,
  ElementNode,
  DirectiveNode,
  Property
} from './ast'
import { isString } from '@vue/shared'
import { CompilerError, defaultOnError } from './errors'

// There are two types of transforms:
//
// - NodeTransform:
//   Transforms that operate directly on a ChildNode. NodeTransforms may mutate,
//   replace or remove the node being processed.
export type NodeTransform = (node: ChildNode, context: TransformContext) => void

// - DirectiveTransform:
//   Transforms that handles a single directive attribute on an element.
//   It translates the raw directive into actual props for the VNode.
export type DirectiveTransform = (
  dir: DirectiveNode,
  context: TransformContext
) => {
  props: Property | Property[]
  needRuntime: boolean
}

// A structural directive transform is a techically a NodeTransform;
// Only v-if and v-for fall into this category.
export type StructuralDirectiveTransform = (
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext
) => void

export interface TransformOptions {
  nodeTransforms?: NodeTransform[]
  directiveTransforms?: { [name: string]: DirectiveTransform }
  onError?: (error: CompilerError) => void
}

export interface TransformContext extends Required<TransformOptions> {
  imports: Set<string>
  statements: string[]
  identifiers: { [name: string]: true }
  parent: ParentNode
  ancestors: ParentNode[]
  childIndex: number
  currentNode: ChildNode | null
  replaceNode(node: ChildNode): void
  removeNode(node?: ChildNode): void
  onNodeRemoved: () => void
}

function createTransformContext(
  root: RootNode,
  options: TransformOptions
): TransformContext {
  const context: TransformContext = {
    imports: new Set(),
    statements: [],
    identifiers: {},
    nodeTransforms: options.nodeTransforms || [],
    directiveTransforms: options.directiveTransforms || {},
    onError: options.onError || defaultOnError,
    parent: root,
    ancestors: [],
    childIndex: 0,
    currentNode: null,
    replaceNode(node) {
      if (__DEV__ && !context.currentNode) {
        throw new Error(`node being replaced is already removed.`)
      }
      context.parent.children[context.childIndex] = context.currentNode = node
    },
    removeNode(node) {
      const list = context.parent.children
      const removalIndex = node
        ? list.indexOf(node)
        : context.currentNode
          ? context.childIndex
          : -1
      if (__DEV__ && removalIndex < 0) {
        throw new Error(`node being removed is not a child of current parent`)
      }
      if (!node || node === context.currentNode) {
        // current node removed
        context.currentNode = null
        context.onNodeRemoved()
      } else {
        // sibling node removed
        if (context.childIndex > removalIndex) {
          context.childIndex--
          context.onNodeRemoved()
        }
      }
      context.parent.children.splice(removalIndex, 1)
    },
    onNodeRemoved: () => {}
  }
  return context
}

export function transform(root: RootNode, options: TransformOptions) {
  const context = createTransformContext(root, options)
  traverseChildren(root, context)
  root.imports = [...context.imports]
  root.statements = context.statements
}

export function traverseChildren(
  parent: ParentNode,
  context: TransformContext
) {
  // ancestors and identifiers need to be cached here since they may get
  // replaced during a child's traversal
  const ancestors = context.ancestors.concat(parent)
  const identifiers = context.identifiers
  let i = 0
  const nodeRemoved = () => {
    i--
  }
  for (; i < parent.children.length; i++) {
    context.parent = parent
    context.ancestors = ancestors
    context.childIndex = i
    context.onNodeRemoved = nodeRemoved
    context.identifiers = identifiers
    traverseNode((context.currentNode = parent.children[i]), context)
  }
}

export function traverseNode(node: ChildNode, context: TransformContext) {
  // apply transform plugins
  const { nodeTransforms } = context
  for (let i = 0; i < nodeTransforms.length; i++) {
    const plugin = nodeTransforms[i]
    plugin(node, context)
    if (!context.currentNode) {
      // node was removed
      return
    } else {
      // node may have been replaced
      node = context.currentNode
    }
  }

  // further traverse downwards
  switch (node.type) {
    case NodeTypes.IF:
      for (let i = 0; i < node.branches.length; i++) {
        traverseChildren(node.branches[i], context)
      }
      break
    case NodeTypes.FOR:
    case NodeTypes.ELEMENT:
      traverseChildren(node, context)
      break
  }
}

export function createStructuralDirectiveTransform(
  name: string | RegExp,
  fn: StructuralDirectiveTransform
): NodeTransform {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n)

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      const { props } = node
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          // structural directives are removed to avoid infinite recursion
          // also we remove them *before* applying so that it can further
          // traverse itself in case it moves the node around
          props.splice(i, 1)
          i--
          fn(node, prop, context)
        }
      }
    }
  }
}
