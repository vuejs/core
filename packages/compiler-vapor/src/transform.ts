import {
  type AllNode,
  type AttributeNode,
  type TransformOptions as BaseTransformOptions,
  type CompilerCompatOptions,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  NodeTypes,
  type RootNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
  type TemplateNode,
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
) => DirectiveTransformResult | void

export interface DirectiveTransformResult {
  key: SimpleExpressionNode
  value: SimpleExpressionNode
  modifier?: '.' | '^'
  runtimeCamelize?: boolean
}

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
  parent: TransformContext<RootNode | ElementNode> | null
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

  const context: TransformContext<RootNode> = {
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
        a = a.filter(filterStatic)
        b = b.filter(filterStatic)
        if (a.length !== b.length) return false
        return (a as SimpleExpressionNode[]).every(
          (exp, i) => exp.content === (b as SimpleExpressionNode[])[i].content,
        )
      }

      function filterStatic(exp: IRExpression): exp is SimpleExpressionNode {
        return !isString(exp) && !exp.isStatic
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
        }
      } else {
        templateNode = {
          type: IRNodeTypes.FRAGMENT_FACTORY,
        }
      }
      root.template.push(templateNode)
      return (this.block.templateIndex = root.template.length - 1)
    },
    registerOperation(...node) {
      this.block.operation.push(...node)
    },
  }
  context.root = context
  context.reference()
  return context
}

function createContext<T extends TemplateChildNode>(
  node: T,
  parent: TransformContext<RootNode | ElementNode>,
  index: number,
): TransformContext<T> {
  return extend({}, parent, {
    node,
    parent,
    index,

    template: '',
    childrenTemplate: [],
    dynamic: genDefaultDynamic(),
  } satisfies Partial<TransformContext<T>>) satisfies TransformContext<T>
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
    template: [],
    templateIndex: -1,
    dynamic: extend(genDefaultDynamic(), {
      flags: DynamicFlag.REFERENCED,
    } satisfies Partial<IRDynamicInfo>),
    effect: [],
    operation: [],
  }

  const context = createRootContext(ir, root, options)

  transformNode(context)
  context.registerTemplate()

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

function transformChildren(context: TransformContext<RootNode | ElementNode>) {
  const { children } = context.node

  for (const [i, child] of children.entries()) {
    const childContext = createContext(child, context, i)
    transformNode(childContext)
    context.childrenTemplate.push(childContext.template)
    context.dynamic.children[i] = childContext.dynamic
  }

  processDynamicChildren(context)
}

function processDynamicChildren(
  context: TransformContext<RootNode | ElementNode>,
) {
  let prevDynamics: IRDynamicInfo[] = []
  let hasStaticTemplate = false

  for (const [index, child] of context.dynamic.children.entries()) {
    if (child.flags & DynamicFlag.INSERT) {
      prevDynamics.push(child)
    }

    if (!(child.flags & DynamicFlag.NON_TEMPLATE)) {
      if (prevDynamics.length) {
        if (hasStaticTemplate) {
          context.childrenTemplate[index - prevDynamics.length] = `<!>`

          prevDynamics[0].flags -= DynamicFlag.NON_TEMPLATE
          const anchor = (prevDynamics[0].anchor = context.increaseId())

          context.registerOperation({
            type: IRNodeTypes.INSERT_NODE,
            element: prevDynamics.map(child => child.id!),
            parent: context.reference(),
            anchor,
          })
        } else {
          context.registerOperation({
            type: IRNodeTypes.PREPEND_NODE,
            elements: prevDynamics.map(child => child.id!),
            parent: context.reference(),
          })
        }
        prevDynamics = []
      }
      hasStaticTemplate = true
    }
  }

  if (prevDynamics.length) {
    context.registerOperation({
      type: IRNodeTypes.APPEND_NODE,
      elements: prevDynamics.map(child => child.id!),
      parent: context.reference(),
    })
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

export function wrapTemplate(node: ElementNode, dirs: string[]): TemplateNode {
  if (node.tagType === ElementTypes.TEMPLATE) {
    return node
  }

  const reserved: Array<AttributeNode | DirectiveNode> = []
  const pass: Array<AttributeNode | DirectiveNode> = []
  node.props.forEach(prop => {
    if (prop.type === NodeTypes.DIRECTIVE && dirs.includes(prop.name)) {
      reserved.push(prop)
    } else {
      pass.push(prop)
    }
  })

  return extend({}, node, {
    type: NodeTypes.ELEMENT,
    tag: 'template',
    props: reserved,
    tagType: ElementTypes.TEMPLATE,
    children: [extend({}, node, { props: pass } as TemplateChildNode)],
  } as Partial<TemplateNode>)
}
