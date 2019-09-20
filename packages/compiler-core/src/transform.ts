import {
  RootNode,
  NodeTypes,
  ParentNode,
  ChildNode,
  ElementNode,
  DirectiveNode
} from './ast'
import { isString } from '@vue/shared'
import { CompilerError, defaultOnError } from './errors'

export type Transform = (node: ChildNode, context: TransformContext) => void

export type DirectiveTransform = (
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext
) => false | void

export interface TransformOptions {
  transforms?: Transform[]
  onError?: (error: CompilerError) => void
}

interface TransformContext {
  transforms: Transform[]
  emitError: (error: CompilerError) => void
  parent: ParentNode
  ancestors: ParentNode[]
  childIndex: number
  currentNode: ChildNode | null
  replaceNode(node: ChildNode): void
  removeNode(node?: ChildNode): void
  onNodeRemoved: () => void
}

export function transform(root: RootNode, options: TransformOptions) {
  const context = createTransformContext(root, options)
  traverseChildren(root, context, context.ancestors)
}

function createTransformContext(
  root: RootNode,
  options: TransformOptions
): TransformContext {
  const context: TransformContext = {
    transforms: options.transforms || [],
    emitError: options.onError || defaultOnError,
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

function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
  ancestors: ParentNode[]
) {
  ancestors = ancestors.concat(parent)
  let i = 0
  const nodeRemoved = () => {
    i--
  }
  for (; i < parent.children.length; i++) {
    context.parent = parent
    context.ancestors = ancestors
    context.childIndex = i
    context.onNodeRemoved = nodeRemoved
    traverseNode((context.currentNode = parent.children[i]), context, ancestors)
  }
}

function traverseNode(
  node: ChildNode,
  context: TransformContext,
  ancestors: ParentNode[]
) {
  // apply transform plugins
  const { transforms } = context
  for (let i = 0; i < transforms.length; i++) {
    const plugin = transforms[i]
    plugin(node, context)
    if (!context.currentNode) {
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
        traverseChildren(node.branches[i], context, ancestors)
      }
      break
    case NodeTypes.FOR:
    case NodeTypes.ELEMENT:
      traverseChildren(node, context, ancestors)
      break
  }
}

const identity = <T>(_: T): T => _

export function createDirectiveTransform(
  name: string | RegExp,
  fn: DirectiveTransform
): Transform {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n)

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      const dirs = node.directives
      let didRemove = false
      for (let i = 0; i < dirs.length; i++) {
        if (matches(dirs[i].name)) {
          const res = fn(node, dirs[i], context)
          // Directives are removed after transformation by default. A transform
          // returning false means the directive should not be removed.
          if (res !== false) {
            ;(dirs as any)[i] = undefined
            didRemove = true
          }
        }
      }
      if (didRemove) {
        node.directives = dirs.filter(identity)
      }
    }
  }
}
