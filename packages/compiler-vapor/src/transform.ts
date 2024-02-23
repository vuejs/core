import {
  type AllNode,
  type TransformOptions as BaseTransformOptions,
  type CommentNode,
  type CompilerCompatOptions,
  type ElementNode,
  ElementTypes,
  NodeTypes,
  type RootNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
  defaultOnError,
  defaultOnWarn,
  isVSlot,
} from '@vue/compiler-dom'
import { EMPTY_OBJ, NOOP, extend, isArray, isString } from '@vue/shared'
import {
  type BlockIRNode,
  DynamicFlag,
  type HackOptions,
  type IRDynamicInfo,
  IRNodeTypes,
  type OperationNode,
  type RootIRNode,
  type VaporDirectiveNode,
} from './ir'
import { isConstantExpression } from './utils'
import { genDefaultDynamic } from './transforms/utils'

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

  comment: CommentNode[]

  inVOnce: boolean

  enterBlock(ir: TransformContext['block']): () => void
  reference(): number
  increaseId(): number
  registerTemplate(): number
  registerEffect(
    expressions: SimpleExpressionNode[],
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
    block: root.block,
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
    dynamic: root.block.dynamic,
    inVOnce: false,
    comment: [],

    increaseId: () => globalId++,
    reference() {
      if (this.dynamic.id !== undefined) return this.dynamic.id
      this.dynamic.flags |= DynamicFlag.REFERENCED
      return (this.dynamic.id = this.increaseId())
    },
    registerEffect(expressions, operations) {
      expressions = expressions.filter(exp => !isConstantExpression(exp))
      if (this.inVOnce || expressions.length === 0) {
        return this.registerOperation(...operations)
      }
      const existing = this.block.effect.find(e =>
        isSameExpression(e.expressions, expressions),
      )
      if (existing) {
        existing.operations.push(...operations)
      } else {
        this.block.effect.push({
          expressions,
          operations,
        })
      }

      function isSameExpression(
        a: SimpleExpressionNode[],
        b: SimpleExpressionNode[],
      ) {
        if (a.length !== b.length) return false
        return a.every((exp, i) => exp.content === b[i].content)
      }
    },

    template: '',
    childrenTemplate: [],
    registerTemplate() {
      if (!this.template) {
        return -1
      }

      const existing = root.template.findIndex(
        template => template === this.template,
      )
      if (existing !== -1) {
        return (this.dynamic.template = existing)
      }

      root.template.push(this.template)
      return (this.dynamic.template = root.template.length - 1)
    },
    registerOperation(...node) {
      this.block.operation.push(...node)
    },
  }
  context.root = context
  return context
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
    block: {
      type: IRNodeTypes.BLOCK,
      node: root,
      dynamic: extend(genDefaultDynamic(), {
        flags: DynamicFlag.REFERENCED,
      } satisfies Partial<IRDynamicInfo>),
      effect: [],
      operation: [],
      returns: [],
    },
  }

  const context = createRootContext(ir, root, options)

  transformNode(context)

  return ir
}

export function transformNode(
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

  // exit transforms
  context.node = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }

  if (context.node.type === NodeTypes.ROOT) {
    context.registerTemplate()
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
