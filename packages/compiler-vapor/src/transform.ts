import type {
  NodeTypes,
  RootNode,
  Node,
  TemplateChildNode,
  ElementNode,
  AttributeNode,
  InterpolationNode,
  TransformOptions,
  DirectiveNode,
  ExpressionNode,
} from '@vue/compiler-dom'
import {
  type OperationNode,
  type RootIRNode,
  IRNodeTypes,
  DynamicInfo,
  InsertAnchor,
} from './ir'
import { isVoidTag } from '@vue/shared'

export interface TransformContext<T extends Node = Node> {
  node: T
  parent: TransformContext | null
  root: TransformContext<RootNode>
  index: number
  options: TransformOptions

  template: string
  dynamic: DynamicInfo

  once: boolean

  reference(): number
  incraseId(): number
  registerTemplate(): number
  registerEffect(expr: string, operation: OperationNode): void
  registerOpration(...oprations: OperationNode[]): void
  helper(name: string): string
}

function createRootContext(
  ir: RootIRNode,
  node: RootNode,
  options: TransformOptions,
): TransformContext<RootNode> {
  let globalId = 0
  const { effect, operation: operation, helpers, vaporHelpers } = ir

  const ctx: TransformContext<RootNode> = {
    node,
    parent: null,
    index: 0,
    root: undefined as any, // set later
    options,
    dynamic: ir.dynamic,
    once: false,

    incraseId: () => globalId++,
    reference() {
      if (this.dynamic.id !== null) return this.dynamic.id
      this.dynamic.referenced = true
      return (this.dynamic.id = this.incraseId())
    },
    registerEffect(expr, operation) {
      if (this.once) {
        return this.registerOpration(operation)
      }
      if (!effect[expr]) effect[expr] = []
      effect[expr].push(operation)
    },

    template: '',
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
    registerOpration(...node) {
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
  parent: TransformContext,
  index: number,
): TransformContext<T> {
  const ctx: TransformContext<T> = {
    ...parent,
    node,
    parent,
    index,

    template: '',
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
    loc: root.loc,
    template: [],
    dynamic: {
      id: null,
      referenced: true,
      ghost: true,
      placeholder: null,
      children: {},
    },
    effect: Object.create(null),
    operation: [],
    helpers: new Set([]),
    vaporHelpers: new Set([]),
  }
  const ctx = createRootContext(ir, root, options)

  // TODO: transform presets, see packages/compiler-core/src/transforms
  transformChildren(ctx, true)
  if (ir.template.length === 0) {
    ir.template.push({
      type: IRNodeTypes.FRAGMENT_FACTORY,
      loc: root.loc,
    })
  }

  return ir
}

function transformChildren(
  ctx: TransformContext<RootNode | ElementNode>,
  root?: boolean,
) {
  const {
    node: { children },
  } = ctx
  const childrenTemplate: string[] = []
  children.forEach((child, i) => walkNode(child, i))

  const dynamicChildren = Object.values(ctx.dynamic.children)
  const dynamicCount = dynamicChildren.reduce(
    (prev, child) => prev + (child.ghost ? 1 : 0),
    0,
  )
  if (dynamicCount === children.length) {
    // all dynamic node
    ctx.registerOpration({
      type: IRNodeTypes.APPEND_NODE,
      loc: ctx.node.loc,
      elements: dynamicChildren.map((child) => child.id!),
      parent: ctx.reference(),
    })
  } else if (dynamicCount > 0 && dynamicCount < children.length) {
    // mixed
    for (const [indexString, child] of Object.entries(ctx.dynamic.children)) {
      if (!child.ghost) continue

      const index = Number(indexString)
      let anchor: InsertAnchor
      if (index === 0) {
        anchor = 'first'
      } else if (index === children.length - 1) {
        anchor = 'last'
      } else {
        childrenTemplate[index] = `<!>`
        anchor = child.placeholder = ctx.incraseId()
      }

      ctx.registerOpration({
        type: IRNodeTypes.INSERT_NODE,
        loc: ctx.node.loc,
        element: child.id!,
        parent: ctx.reference(),
        anchor,
      })
    }
  }

  ctx.template += childrenTemplate.join('')

  // finalize template
  if (root) ctx.registerTemplate()

  function walkNode(node: TemplateChildNode, index: number) {
    const child = createContext(node, ctx, index)
    const isFirst = index === 0
    const isLast = index === children.length - 1

    switch (node.type) {
      case 1 satisfies NodeTypes.ELEMENT: {
        transformElement(child as TransformContext<ElementNode>)
        break
      }
      case 2 satisfies NodeTypes.TEXT: {
        child.template += node.content
        break
      }
      case 3 satisfies NodeTypes.COMMENT: {
        child.template += `<!--${node.content}-->`
        break
      }
      case 5 satisfies NodeTypes.INTERPOLATION: {
        transformInterpolation(
          child as TransformContext<InterpolationNode>,
          isFirst,
          isLast,
        )
        break
      }
      case 12 satisfies NodeTypes.TEXT_CALL:
        // never?
        break
      default: {
        // TODO handle other types
        // CompoundExpressionNode
        // IfNode
        // IfBranchNode
        // ForNode
        child.template += `[type: ${node.type}]`
      }
    }

    childrenTemplate.push(child.template)

    if (
      child.dynamic.ghost ||
      child.dynamic.referenced ||
      child.dynamic.placeholder ||
      Object.keys(child.dynamic.children).length
    ) {
      ctx.dynamic.children[index] = child.dynamic
    }
  }
}

function transformElement(ctx: TransformContext<ElementNode>) {
  const { node } = ctx
  const { tag, props, children } = node

  ctx.template += `<${tag}`

  props.forEach((prop) => transformProp(prop, ctx))
  ctx.template += `>`

  if (children.length) transformChildren(ctx)

  // TODO remove unnecessary close tag, e.g. if it's the last element of the template
  if (!node.isSelfClosing || !isVoidTag(tag)) {
    ctx.template += `</${tag}>`
  }
}

function transformInterpolation(
  ctx: TransformContext<InterpolationNode>,
  isFirst: boolean,
  isLast: boolean,
) {
  const { node } = ctx

  if (node.content.type === (8 satisfies NodeTypes.COMPOUND_EXPRESSION)) {
    // TODO: CompoundExpressionNode: {{ count + 1 }}
    return
  }

  const expr = processExpression(ctx, node.content)!

  if (isFirst && isLast) {
    const parent = ctx.parent!
    const parentId = parent.reference()
    ctx.registerEffect(expr, {
      type: IRNodeTypes.SET_TEXT,
      loc: node.loc,
      element: parentId,
      value: expr,
    })
  } else {
    const id = ctx.reference()
    ctx.dynamic.ghost = true
    ctx.registerOpration({
      type: IRNodeTypes.CREATE_TEXT_NODE,
      loc: node.loc,
      id,
      value: expr,
    })
    ctx.registerEffect(expr, {
      type: IRNodeTypes.SET_TEXT,
      loc: node.loc,
      element: id,
      value: expr,
    })
  }
}

function transformProp(
  node: DirectiveNode | AttributeNode,
  ctx: TransformContext<ElementNode>,
): void {
  const { name } = node

  if (node.type === (6 satisfies NodeTypes.ATTRIBUTE)) {
    if (node.value) {
      ctx.template += ` ${name}="${node.value.content}"`
    } else {
      ctx.template += ` ${name}`
    }
    return
  }

  const expr = processExpression(ctx, node.exp)
  switch (name) {
    case 'bind': {
      if (expr === null) {
        // TODO: Vue 3.4 supported shorthand syntax
        // https://github.com/vuejs/core/pull/9451
        return
      } else if (!node.arg) {
        // TODO support v-bind="{}"
        return
      } else if (
        node.arg.type === (8 satisfies NodeTypes.COMPOUND_EXPRESSION)
      ) {
        // TODO support :[foo]="bar"
        return
      }

      ctx.registerEffect(expr, {
        type: IRNodeTypes.SET_PROP,
        loc: node.loc,
        element: ctx.reference(),
        name: node.arg.content,
        value: expr,
      })
      break
    }
    case 'on': {
      if (!node.arg) {
        // TODO support v-on="{}"
        return
      } else if (
        node.arg.type === (8 satisfies NodeTypes.COMPOUND_EXPRESSION)
      ) {
        // TODO support @[foo]="bar"
        return
      } else if (expr === null) {
        // TODO: support @foo
        // https://github.com/vuejs/core/pull/9451
        return
      }

      ctx.registerEffect(expr, {
        type: IRNodeTypes.SET_EVENT,
        loc: node.loc,
        element: ctx.reference(),
        name: node.arg.content,
        value: expr,
      })
      break
    }
    case 'html': {
      const value = expr || '""'
      ctx.registerEffect(value, {
        type: IRNodeTypes.SET_HTML,
        loc: node.loc,
        element: ctx.reference(),
        value,
      })
      break
    }
    case 'text': {
      const value = expr || '""'
      ctx.registerEffect(value, {
        type: IRNodeTypes.SET_TEXT,
        loc: node.loc,
        element: ctx.reference(),
        value,
      })
      break
    }
    case 'once': {
      ctx.once = true
      break
    }
    case 'cloak': {
      // do nothing
      break
    }
  }
}

// TODO: reuse packages/compiler-core/src/transforms/transformExpression.ts
function processExpression(
  ctx: TransformContext,
  expr: ExpressionNode | undefined,
): string | null {
  if (!expr) return null
  if (expr.type === (8 satisfies NodeTypes.COMPOUND_EXPRESSION)) {
    // TODO
    return ''
  }
  const { content } = expr
  if (ctx.options.bindingMetadata?.[content] === 'setup-ref') {
    return content + '.value'
  }
  return content
}
