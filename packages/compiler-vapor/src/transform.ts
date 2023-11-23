import {
  type NodeTypes,
  RootNode,
  Node,
  TemplateChildNode,
  ElementNode,
  AttributeNode,
  SourceLocation,
  InterpolationNode,
  TransformOptions,
  DirectiveNode,
} from '@vue/compiler-dom'

export const enum IRNodeTypes {
  ROOT,
  TEMPLATE_GENERATOR,
  SET_PROP,
  SET_TEXT,
  SET_EVENT,

  INSERT_NODE,
  TEXT_NODE,
}

export interface IRNode {
  type: IRNodeTypes
  loc: SourceLocation
}

export interface RootIRNode extends IRNode {
  type: IRNodeTypes.ROOT
  template: Array<TemplateGeneratorIRNode>
  children: DynamicChildren
  effect: Record<string, EffectNode[]>
  opration: OprationNode[]
  helpers: Set<string>
}

export interface TemplateGeneratorIRNode extends IRNode {
  type: IRNodeTypes.TEMPLATE_GENERATOR
  template: string
}

export interface SetPropIRNode extends IRNode {
  type: IRNodeTypes.SET_PROP
  element: number
  name: string
}

export interface SetTextIRNode extends IRNode {
  type: IRNodeTypes.SET_TEXT
  element: number
}

export interface SetEventIRNode extends IRNode {
  type: IRNodeTypes.SET_EVENT
  element: number
  name: string
}

export interface TextNodeIRNode extends IRNode {
  type: IRNodeTypes.TEXT_NODE
  id: number
  content: string
}

export interface InsertNodeIRNode extends IRNode {
  type: IRNodeTypes.INSERT_NODE
  element: number
  parent: number
  anchor: number | 'first' | 'last'
}

export type EffectNode = SetPropIRNode | SetTextIRNode | SetEventIRNode
export type OprationNode = TextNodeIRNode | InsertNodeIRNode

export interface DynamicChild {
  id: number | null
  store: boolean
  children: DynamicChildren
}
export type DynamicChildren = Record<number, DynamicChild>

export interface TransformContext<T extends Node = Node> {
  node: T
  parent: TransformContext | null
  root: TransformContext<RootNode>
  index: number
  options: TransformOptions
  ir: RootIRNode
  template: string
  children: DynamicChildren
  store: boolean
  ghost: boolean

  getElementId(): number
  registerEffect(expr: string, effectNode: EffectNode): void
  registerTemplate(): number
}

function createRootContext(
  ir: RootIRNode,
  node: RootNode,
  options: TransformOptions,
): TransformContext<RootNode> {
  let i = 0
  const { effect: bindings } = ir

  const ctx: TransformContext<RootNode> = {
    node,
    parent: null,
    index: 0,
    root: undefined as any, // set later
    options,
    ir,
    children: {},
    store: false,
    ghost: false,

    getElementId: () => i++,
    registerEffect(expr, effectNode) {
      if (!bindings[expr]) bindings[expr] = []
      bindings[expr].push(effectNode)
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
  }
  return ctx
}

// AST -> IR
export function transform(
  root: RootNode,
  options: TransformOptions = {},
): RootIRNode {
  // {
  //   type: IRNodeTypes.TEMPLATE_GENERATOR,
  //   template,
  //   loc: root.loc
  // }

  const ir: RootIRNode = {
    type: IRNodeTypes.ROOT,
    loc: root.loc,
    template: [],
    children: {},
    effect: Object.create(null),
    opration: [],
    helpers: new Set(['template']),
  }
  const ctx = createRootContext(ir, root, options)
  transformChildren(ctx, true)
  ctx.registerTemplate()
  ir.children = ctx.children

  console.log(JSON.stringify(ir, undefined, 2))

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

  function walkNode(node: TemplateChildNode, i: number) {
    const child = createContext(node, ctx, index)
    const isFirst = i === 0
    const isLast = i === children.length - 1

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
      default: {
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
  ctx.template += node.isSelfClosing ? '/>' : `>`

  if (children.length > 0) {
    transformChildren(ctx)
  }
  if (!node.isSelfClosing) ctx.template += `</${tag}>`
}

function transformInterpolation(
  ctx: TransformContext<InterpolationNode>,
  isFirst: boolean,
  isLast: boolean,
) {
  const { node } = ctx

  if (node.content.type === (4 satisfies NodeTypes.SIMPLE_EXPRESSION)) {
    const expr = processExpression(ctx, node.content.content)

    const parent = ctx.parent!
    const parentId = parent.getElementId()
    parent.store = true

    if (isFirst && isLast) {
      ctx.registerEffect(expr, {
        type: IRNodeTypes.SET_TEXT,
        loc: node.loc,
        element: parentId,
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

      ctx.ir.opration.push(
        {
          type: IRNodeTypes.TEXT_NODE,
          loc: node.loc,
          id,
          content: expr,
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
      })
    }
  } else {
    // TODO
  }
  // TODO
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

  if (!node.exp) {
    // TODO
    return
  } else if (node.exp.type === (8 satisfies NodeTypes.COMPOUND_EXPRESSION)) {
    // TODO
    return
  } else if (
    !node.arg ||
    node.arg.type === (8 satisfies NodeTypes.COMPOUND_EXPRESSION)
  ) {
    // TODO
    return
  }

  const expr = processExpression(ctx, node.exp.content)
  ctx.store = true
  if (name === 'bind') {
    ctx.registerEffect(expr, {
      type: IRNodeTypes.SET_PROP,
      loc: node.loc,
      element: ctx.getElementId(),
      name: node.arg.content,
    })
  } else if (name === 'on') {
    ctx.registerEffect(expr, {
      type: IRNodeTypes.SET_EVENT,
      loc: node.loc,
      element: ctx.getElementId(),
      name: node.arg.content,
    })
  }
}

function processExpression(ctx: TransformContext, expr: string) {
  if (ctx.options.bindingMetadata?.[expr] === 'setup-ref') {
    expr += '.value'
  }
  return expr
}
