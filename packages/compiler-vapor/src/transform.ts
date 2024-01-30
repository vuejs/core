import {
  type AllNode,
  type TransformOptions as BaseTransformOptions,
  type CompilerCompatOptions,
  type ElementNode,
  ElementTypes,
  NodeTypes,
  type ParentNode,
  type RootNode,
  type TemplateChildNode,
  defaultOnError,
  defaultOnWarn,
  isVSlot,
} from '@vue/compiler-dom'
import { EMPTY_OBJ, NOOP, extend, isArray, isString } from '@vue/shared'
import {
  type BlockIRNode,
  DynamicFlag,
  type FragmentFactoryIRNode,
  type HackOptions,
  type IRDynamicInfo,
  type IRExpression,
  IRNodeTypes,
  type OperationNode,
  type RootIRNode,
  type TemplateFactoryIRNode,
  type VaporDirectiveNode,
} from './ir'

export type NodeTransform = (
  node: RootNode | TemplateChildNode,
  context: TransformContext<RootNode | TemplateChildNode>,
) => void | (() => void) | (() => void)[]

export type DirectiveTransform = (
  dir: VaporDirectiveNode,
  node: ElementNode,
  context: TransformContext<ElementNode>,
) => void

// A structural directive transform is technically also a NodeTransform;
// Only v-if and v-for fall into this category.
export type StructuralDirectiveTransform = (
  node: ElementNode,
  dir: VaporDirectiveNode,
  context: TransformContext<ElementNode>,
) => void | (() => void)

export type TransformOptions = HackOptions<BaseTransformOptions>

export interface TransformContext<T extends AllNode = AllNode> {
  node: T
  parent: TransformContext<ParentNode> | null
  root: TransformContext<RootNode>
  index: number
  block: BlockIRNode
  options: Required<
    Omit<TransformOptions, 'filename' | keyof CompilerCompatOptions>
  >

  template: string
  childrenTemplate: (string | null)[]
  dynamic: IRDynamicInfo

  inVOnce: boolean

  enterBlock(ir: TransformContext['block']): () => void
  reference(): number
  increaseId(): number
  registerTemplate(): number
  registerEffect(
    expressions: Array<IRExpression | null | undefined>,
    operation: OperationNode[],
  ): void
  registerOperation(...operations: OperationNode[]): void
}

const defaultOptions = {
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
}

export const genDefaultDynamic = (): IRDynamicInfo => ({
  id: null,
  flags: DynamicFlag.NONE,
  anchor: null,
  children: [],
})

// TODO use class for better perf
function createRootContext(
  root: RootIRNode,
  node: RootNode,
  options: TransformOptions = {},
): TransformContext<RootNode> {
  let globalId = 0

  const ctx: TransformContext<RootNode> = {
    node,
    parent: null,
    index: 0,
    root: null!, // set later
    block: root,
    enterBlock(ir) {
      const { block, template, dynamic, childrenTemplate } = this
      this.block = ir
      this.dynamic = ir.dynamic
      this.template = ''
      this.childrenTemplate = []
      return () => {
        // exit
        this.block = block
        this.template = template
        this.dynamic = dynamic
        this.childrenTemplate = childrenTemplate
      }
    },
    options: extend({}, defaultOptions, options),
    dynamic: root.dynamic,
    inVOnce: false,

    increaseId: () => globalId++,
    reference() {
      if (this.dynamic.id !== null) return this.dynamic.id
      this.dynamic.flags |= DynamicFlag.REFERENCED
      return (this.dynamic.id = this.increaseId())
    },
    registerEffect(expressions, operations) {
      if (
        this.inVOnce ||
        (expressions = expressions.filter(Boolean)).length === 0
      ) {
        return this.registerOperation(...operations)
      }
      const existing = this.block.effect.find(e =>
        isSameExpression(e.expressions, expressions as IRExpression[]),
      )
      if (existing) {
        existing.operations.push(...operations)
      } else {
        this.block.effect.push({
          expressions: expressions as IRExpression[],
          operations,
        })
      }

      function isSameExpression(a: IRExpression[], b: IRExpression[]) {
        if (a.length !== b.length) return false
        return a.every(
          (exp, i) => identifyExpression(exp) === identifyExpression(b[i]),
        )
      }

      function identifyExpression(exp: IRExpression) {
        return typeof exp === 'string' ? exp : exp.content
      }
    },

    template: '',
    childrenTemplate: [],
    registerTemplate() {
      let templateNode: TemplateFactoryIRNode | FragmentFactoryIRNode

      const existing = root.template.findIndex(t =>
        this.template
          ? t.type === IRNodeTypes.TEMPLATE_FACTORY &&
            t.template === this.template
          : t.type === IRNodeTypes.FRAGMENT_FACTORY,
      )
      if (existing !== -1) {
        return (this.block.templateIndex = existing)
      }

      if (this.template) {
        templateNode = {
          type: IRNodeTypes.TEMPLATE_FACTORY,
          template: this.template,
          loc: node.loc,
        }
      } else {
        templateNode = {
          type: IRNodeTypes.FRAGMENT_FACTORY,
          loc: node.loc,
        }
      }
      root.template.push(templateNode)
      return (this.block.templateIndex = root.template.length - 1)
    },
    registerOperation(...node) {
      this.block.operation.push(...node)
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
  const ctx: TransformContext<T> = extend({}, parent, {
    node,
    parent,
    index,

    template: '',
    childrenTemplate: [],
    dynamic: genDefaultDynamic(),
  } satisfies Partial<TransformContext<T>>)
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
    templateIndex: -1,
    dynamic: extend(genDefaultDynamic(), {
      flags: DynamicFlag.REFERENCED,
    } satisfies Partial<IRDynamicInfo>),
    effect: [],
    operation: [],
  }

  const ctx = createRootContext(ir, root, options)

  transformNode(ctx)
  ctx.registerTemplate()

  return ir
}

function transformNode(
  context: TransformContext<RootNode | TemplateChildNode>,
) {
  let { node } = context

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
  }

  // exit transforms
  context.node = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }

  if (context.node.type === NodeTypes.ROOT)
    context.template += context.childrenTemplate.filter(Boolean).join('')
}

function transformChildren(ctx: TransformContext<RootNode | ElementNode>) {
  const { children } = ctx.node

  for (const [i, child] of children.entries()) {
    const childContext = createContext(child, ctx, i)
    transformNode(childContext)
    ctx.childrenTemplate.push(childContext.template)
    ctx.dynamic.children[i] = childContext.dynamic
  }

  processDynamicChildren(ctx)
}

function processDynamicChildren(ctx: TransformContext<RootNode | ElementNode>) {
  const { node } = ctx

  let prevChildren: IRDynamicInfo[] = []
  let hasStatic = false

  for (const [index, child] of ctx.dynamic.children.entries()) {
    if (!child || !(child.flags & DynamicFlag.INSERT)) {
      if (prevChildren.length) {
        if (hasStatic) {
          ctx.childrenTemplate[index - prevChildren.length] = `<!>`

          prevChildren[0].flags -= DynamicFlag.NON_TEMPLATE
          const anchor = (prevChildren[0].anchor = ctx.increaseId())

          ctx.registerOperation({
            type: IRNodeTypes.INSERT_NODE,
            loc: node.loc,
            element: prevChildren.map(child => child.id!),
            parent: ctx.reference(),
            anchor,
          })
        } else {
          ctx.registerOperation({
            type: IRNodeTypes.PREPEND_NODE,
            loc: node.loc,
            elements: prevChildren.map(child => child.id!),
            parent: ctx.reference(),
          })
        }
      }
      hasStatic = true
      prevChildren = []
      continue
    }

    prevChildren.push(child)

    if (index === ctx.dynamic.children.length - 1) {
      ctx.registerOperation({
        type: IRNodeTypes.APPEND_NODE,
        loc: node.loc,
        elements: prevChildren.map(child => child.id!),
        parent: ctx.reference(),
      })
    }
  }
}

export function createStructuralDirectiveTransform(
  name: string | string[],
  fn: StructuralDirectiveTransform,
): NodeTransform {
  const matches = (n: string) =>
    isString(name) ? n === name : name.includes(n)

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      const { props } = node
      // structural directive transforms are not concerned with slots
      // as they are handled separately in vSlot.ts
      if (node.tagType === ElementTypes.TEMPLATE && props.some(isVSlot)) {
        return
      }
      const exitFns = []
      for (const prop of props) {
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          const onExit = fn(
            node,
            prop as VaporDirectiveNode,
            context as TransformContext<ElementNode>,
          )
          if (onExit) exitFns.push(onExit)
        }
      }
      return exitFns
    }
  }
}
