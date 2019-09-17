import {
  RootNode,
  NodeTypes,
  ParentNode,
  ChildNode,
  ElementNode,
  DirectiveNode
} from './ast'
import { isString } from '@vue/shared'
import { CompilerError } from './errors'

export type Transform = (node: ChildNode, context: TransformContext) => void

export type DirectiveTransform = (
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext
) => false | void

export interface TransformOptions {
  transforms: Transform[]
  onError?: (error: CompilerError) => void
}

export interface TransformContext extends Required<TransformOptions> {
  parent: ParentNode
  ancestors: ParentNode[]
  childIndex: number
  replaceNode(node: ChildNode): void
  removeNode(): void
  nodeRemoved: boolean
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
    onError(error: CompilerError) {
      throw error
    },
    ...options,
    parent: root,
    ancestors: [root],
    childIndex: 0,
    replaceNode(node) {
      context.parent.children[context.childIndex] = node
    },
    removeNode() {
      context.parent.children.splice(context.childIndex, 1)
      context.nodeRemoved = true
    },
    nodeRemoved: false
  }
  return context
}

function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
  ancestors: ParentNode[]
) {
  ancestors = ancestors.concat(parent)
  for (let i = 0; i < parent.children.length; i++) {
    context.parent = parent
    context.ancestors = ancestors
    context.childIndex = i
    traverseNode(parent.children[i], context, ancestors)
    if (context.nodeRemoved) {
      i--
    }
  }
}

function traverseNode(
  node: ChildNode,
  context: TransformContext,
  ancestors: ParentNode[]
) {
  // apply transform plugins
  const transforms = context.transforms
  for (let i = 0; i < transforms.length; i++) {
    const transform = transforms[i]
    context.nodeRemoved = false
    transform(node, context)
    if (context.nodeRemoved) {
      return
    } else {
      // node may have been replaced
      node = context.parent.children[context.childIndex]
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
