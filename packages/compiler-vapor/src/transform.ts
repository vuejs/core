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
  type DynamicChildren,
  type OperationNode,
  type RootIRNode,
  IRNodeTypes,
} from './ir'
import { isVoidTag } from '@vue/shared'

export interface TransformContext<T extends Node = Node> {
  node: T
  parent: TransformContext | null
  root: TransformContext<RootNode>
  index: number
  options: TransformOptions
  // ir: RootIRNode
  template: string
  children: DynamicChildren
  store: boolean
  ghost: boolean
  once: boolean

  getElementId(): number
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
  let i = 0
  const { effect, operation: operation, helpers, vaporHelpers } = ir

  const ctx: TransformContext<RootNode> = {
    node,
    parent: null,
    index: 0,
    root: undefined as any, // set later
    options,
    children: {},
    store: false,
    ghost: false,
    once: false,

    getElementId: () => i++,
    registerEffect(expr, operation) {
      if (!effect[expr]) effect[expr] = []
      effect[expr].push(operation)
    },

    template: '',
    registerTemplate() {
      if (!ctx.template) return -1

      const idx = ir.template.findIndex((t) => t.template === ctx.template)
      if (idx !== -1) return idx

      ir.template.push({
        type: IRNodeTypes.TEMPLATE_GENERATOR,
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
  return ctx
}

function createContext<T extends TemplateChildNode>(
  node: T,
  parent: TransformContext,
  index: number,
): TransformContext<T> {
  let id: number | undefined
  const getElementId = () => {
    if (id !== undefined) return id
    return (id = parent.root.getElementId())
  }
  const children = {}

  const ctx: TransformContext<T> = {
    ...parent,
    node,
    parent,
    index,
    get template() {
      return parent.template
    },
    set template(t) {
      parent.template = t
    },
    getElementId,

    children,
    store: false,
    registerEffect(expr, operation) {
      if (ctx.once) {
        return ctx.registerOpration(operation)
      }
      return parent.registerEffect(expr, operation)
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
    children: {},
    effect: Object.create(null),
    operation: [],
    helpers: new Set([]),
    vaporHelpers: new Set([]),
  }
  const ctx = createRootContext(ir, root, options)

  // TODO: transform presets, see packages/compiler-core/src/transforms
  transformChildren(ctx, true)
  ir.children = ctx.children

  return ir
}

function transformChildren(
  ctx: TransformContext<RootNode | ElementNode>,
  root?: boolean,
) {
  const {
    node: { children },
  } = ctx
  let index = 0
  children.forEach((child, i) => walkNode(child, i))

  if (root) ctx.registerTemplate()

  function walkNode(node: TemplateChildNode, i: number) {
    const child = createContext(node, ctx, index)
    const isFirst = i === 0
    const isLast = i === children.length - 1

    // TODO: multiple root elements
    if (root) {
      child.store = true
      // generate id for root element early
      child.getElementId()
    }

    switch (node.type) {
      case 1 satisfies NodeTypes.ELEMENT: {
        transformElement(child as TransformContext<ElementNode>)
        break
      }
      case 2 satisfies NodeTypes.TEXT: {
        ctx.template += node.content
        break
      }
      case 3 satisfies NodeTypes.COMMENT: {
        ctx.template += `<!--${node.content}-->`
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
        ctx.template += `[type: ${node.type}]`
      }
    }

    if (Object.keys(child.children).length > 0 || child.store)
      ctx.children[index] = {
        id: child.store ? child.getElementId() : null,
        store: child.store,
        children: child.children,
      }

    if (!child.ghost) index++
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

  if (node.content.type === (4 satisfies NodeTypes.SIMPLE_EXPRESSION)) {
    const expr = processExpression(ctx, node.content)!

    const parent = ctx.parent!
    const parentId = parent.getElementId()
    parent.store = true

    if (isFirst && isLast) {
      ctx.registerEffect(expr, {
        type: IRNodeTypes.SET_TEXT,
        loc: node.loc,
        element: parentId,
        value: expr,
      })
    } else {
      let id: number
      let anchor: number | 'first' | 'last'

      if (!isFirst && !isLast) {
        id = ctx.root.getElementId()
        anchor = ctx.getElementId()
        ctx.template += '<!>'
        ctx.store = true
      } else {
        id = ctx.getElementId()
        ctx.ghost = true
        anchor = isFirst ? 'first' : 'last'
      }

      ctx.registerOpration(
        {
          type: IRNodeTypes.TEXT_NODE,
          loc: node.loc,
          id,
          value: expr,
        },
        {
          type: IRNodeTypes.INSERT_NODE,
          loc: node.loc,
          element: id,
          parent: parentId,
          anchor,
        },
      )

      ctx.registerEffect(expr, {
        type: IRNodeTypes.SET_TEXT,
        loc: node.loc,
        element: id,
        value: expr,
      })
    }
    return
  }

  // TODO: CompoundExpressionNode: {{ count + 1 }}
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

  ctx.store = true
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
        element: ctx.getElementId(),
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
        element: ctx.getElementId(),
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
        element: ctx.getElementId(),
        value,
      })
      break
    }
    case 'text': {
      const value = expr || '""'
      ctx.registerEffect(value, {
        type: IRNodeTypes.SET_TEXT,
        loc: node.loc,
        element: ctx.getElementId(),
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
