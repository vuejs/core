import {
  type RootNode,
  type TemplateChildNode,
  type ElementNode,
  type InterpolationNode,
  type TransformOptions as BaseTransformOptions,
  type ParentNode,
  type AllNode,
  type CompilerCompatOptions,
  NodeTypes,
  defaultOnError,
  defaultOnWarn,
  DirectiveNode,
} from '@vue/compiler-dom'
import { EMPTY_OBJ, NOOP, isArray } from '@vue/shared'
import {
  type OperationNode,
  type RootIRNode,
  type IRDynamicInfo,
  type IRExpression,
  IRNodeTypes,
} from './ir'
import type { HackOptions } from './hack'

export type NodeTransform = (
  node: RootNode | TemplateChildNode,
  context: TransformContext<RootNode | TemplateChildNode>,
) => void | (() => void) | (() => void)[]

export type DirectiveTransform = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext,
  // a platform specific compiler can import the base transform and augment
  // it by passing in this optional argument.
  // augmentor?: (ret: DirectiveTransformResult) => DirectiveTransformResult,
) => void

export type TransformOptions = HackOptions<BaseTransformOptions>

export interface TransformContext<T extends AllNode = AllNode> {
  node: T
  parent: TransformContext<ParentNode> | null
  root: TransformContext<RootNode>
  index: number
  options: Required<
    Omit<TransformOptions, 'filename' | keyof CompilerCompatOptions>
  >

  template: string
  childrenTemplate: string[]
  dynamic: IRDynamicInfo

  inVOnce: boolean

  reference(): number
  increaseId(): number
  registerTemplate(): number
  registerEffect(
    expressions: Array<IRExpression | null | undefined>,
    operation: OperationNode[],
  ): void
  registerOperation(...operations: OperationNode[]): void
  helper(name: string): string
}

// TODO use class for better perf
function createRootContext(
  ir: RootIRNode,
  node: RootNode,
  options: TransformOptions = {},
): TransformContext<RootNode> {
  let globalId = 0
  const { effect, operation: operation, helpers, vaporHelpers } = ir

  const ctx: TransformContext<RootNode> = {
    node,
    parent: null,
    index: 0,
    root: null!, // set later
    options: {
      filename: '',
      prefixIdentifiers: false,
      hoistStatic: false,
      hmr: false,
      cacheHandlers: false,
      nodeTransforms: [],
      directiveTransforms: {},
      transformHoist: null,
      isBuiltInComponent: NOOP,
      isCustomElement: NOOP,
      expressionPlugins: [],
      scopeId: null,
      slotted: true,
      ssr: false,
      inSSR: false,
      ssrCssVars: ``,
      bindingMetadata: EMPTY_OBJ,
      inline: false,
      isTS: false,
      onError: defaultOnError,
      onWarn: defaultOnWarn,
      ...options,
    },
    dynamic: ir.dynamic,
    inVOnce: false,

    increaseId: () => globalId++,
    reference() {
      if (this.dynamic.id !== null) return this.dynamic.id
      this.dynamic.referenced = true
      return (this.dynamic.id = this.increaseId())
    },
    registerEffect(expressions, operations) {
      if (
        this.inVOnce ||
        (expressions = expressions.filter(Boolean)).length === 0
      ) {
        return this.registerOperation(...operations)
      }
      // TODO combine effects
      effect.push({
        expressions: expressions as IRExpression[],
        operations,
      })
    },

    template: '',
    childrenTemplate: [],
    registerTemplate() {
      if (!ctx.template) return -1

      const idx = ir.template.findIndex(
        (t) =>
          t.type === IRNodeTypes.TEMPLATE_FACTORY &&
          t.template === ctx.template,
      )
      if (idx !== -1) return idx

      ir.template.push({
        type: IRNodeTypes.TEMPLATE_FACTORY,
        template: ctx.template,
        loc: node.loc,
      })
      return ir.template.length - 1
    },
    registerOperation(...node) {
      operation.push(...node)
    },
    // TODO not used yet
    helper(name, vapor = true) {
      ;(vapor ? vaporHelpers : helpers).add(name)
      return name
    },
  }
  ctx.root = ctx
  ctx.reference()
  return ctx
}

function createContext<T extends TemplateChildNode>(
  node: T,
  parent: TransformContext<ParentNode>,
  index: number,
): TransformContext<T> {
  const ctx: TransformContext<T> = {
    ...parent,
    node,
    parent,
    index,

    template: '',
    childrenTemplate: [],
    dynamic: {
      id: null,
      referenced: false,
      ghost: false,
      placeholder: null,
      children: {},
    },
  }
  return ctx
}

// AST -> IR
export function transform(
  root: RootNode,
  options: TransformOptions = {},
): RootIRNode {
  const ir: RootIRNode = {
    type: IRNodeTypes.ROOT,
    node: root,
    source: root.source,
    loc: root.loc,
    template: [],
    dynamic: {
      id: null,
      referenced: true,
      ghost: true,
      placeholder: null,
      children: {},
    },
    effect: [],
    operation: [],
    helpers: new Set([]),
    vaporHelpers: new Set([]),
  }

  const ctx = createRootContext(ir, root, options)
  transformNode(ctx)

  if (ctx.node.type === NodeTypes.ROOT) {
    ctx.registerTemplate()
  }
  if (ir.template.length === 0) {
    ir.template.push({
      type: IRNodeTypes.FRAGMENT_FACTORY,
      loc: root.loc,
    })
  }

  return ir
}

function transformNode(
  context: TransformContext<RootNode | TemplateChildNode>,
) {
  let { node, index } = context

  // apply transform plugins
  const { nodeTransforms } = context.options
  const exitFns = []
  for (const nodeTransform of nodeTransforms) {
    const onExit = nodeTransform(node, context)
    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit)
      } else {
        exitFns.push(onExit)
      }
    }
    if (!context.node) {
      // node was removed
      return
    } else {
      // node may have been replaced
      node = context.node
    }
  }

  const parentChildren = context.parent ? context.parent.node.children : []
  const isFirst = index === 0
  const isLast = index === parentChildren.length - 1

  switch (node.type) {
    case NodeTypes.ROOT:
    case NodeTypes.ELEMENT: {
      transformChildren(context as TransformContext<RootNode | ElementNode>)
      break
    }
    case NodeTypes.TEXT: {
      context.template += node.content
      break
    }
    case NodeTypes.COMMENT: {
      context.template += `<!--${node.content}-->`
      break
    }
    case NodeTypes.INTERPOLATION: {
      transformInterpolation(
        context as TransformContext<InterpolationNode>,
        isFirst,
        isLast,
      )
      break
    }
    case NodeTypes.TEXT_CALL:
      // never
      break
    default: {
      // TODO handle other types
      // CompoundExpressionNode
      // IfNode
      // IfBranchNode
      // ForNode
      context.template += `[type: ${node.type}]`
    }
  }

  // exit transforms
  context.node = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }

  if (context.node.type === NodeTypes.ROOT)
    context.template += context.childrenTemplate.join('')
}

function transformChildren(ctx: TransformContext<RootNode | ElementNode>) {
  const { children } = ctx.node
  let i = 0
  // const nodeRemoved = () => {
  //   i--
  // }
  for (; i < children.length; i++) {
    const child = children[i]
    const childContext = createContext(child, ctx, i)
    transformNode(childContext)
    ctx.childrenTemplate.push(childContext.template)
    if (
      childContext.dynamic.ghost ||
      childContext.dynamic.referenced ||
      childContext.dynamic.placeholder ||
      Object.keys(childContext.dynamic.children).length
    ) {
      ctx.dynamic.children[i] = childContext.dynamic
    }
  }

  processDynamicChildren(ctx)
}

function processDynamicChildren(ctx: TransformContext<RootNode | ElementNode>) {
  const { node } = ctx

  let prevChildren: IRDynamicInfo[] = []
  let hasStatic = false

  for (let index = 0; index < node.children.length; index++) {
    const child = ctx.dynamic.children[index]

    if (!child || !child.ghost) {
      if (prevChildren.length) {
        if (hasStatic) {
          ctx.childrenTemplate[index - prevChildren.length] = `<!>`
          const anchor = (prevChildren[0].placeholder = ctx.increaseId())

          ctx.registerOperation({
            type: IRNodeTypes.INSERT_NODE,
            loc: node.loc,
            element: prevChildren.map((child) => child.id!),
            parent: ctx.reference(),
            anchor,
          })
        } else {
          ctx.registerOperation({
            type: IRNodeTypes.PREPEND_NODE,
            loc: node.loc,
            elements: prevChildren.map((child) => child.id!),
            parent: ctx.reference(),
          })
        }
      }
      hasStatic = true
      prevChildren = []
      continue
    }

    prevChildren.push(child)

    if (index === node.children.length - 1) {
      ctx.registerOperation({
        type: IRNodeTypes.APPEND_NODE,
        loc: node.loc,
        elements: prevChildren.map((child) => child.id!),
        parent: ctx.reference(),
      })
    }
  }
}

function transformInterpolation(
  ctx: TransformContext<InterpolationNode>,
  isFirst: boolean,
  isLast: boolean,
) {
  const { node } = ctx

  const expr = node.content

  if (isFirst && isLast) {
    const parent = ctx.parent!
    const parentId = parent.reference()
    ctx.registerEffect(
      [expr],
      [
        {
          type: IRNodeTypes.SET_TEXT,
          loc: node.loc,
          element: parentId,
          value: expr,
        },
      ],
    )
  } else {
    const id = ctx.reference()
    ctx.dynamic.ghost = true
    ctx.registerOperation({
      type: IRNodeTypes.CREATE_TEXT_NODE,
      loc: node.loc,
      id,
      value: expr,
    })
    ctx.registerEffect(
      [expr],
      [
        {
          type: IRNodeTypes.SET_TEXT,
          loc: node.loc,
          element: id,
          value: expr,
        },
      ],
    )
  }
}
