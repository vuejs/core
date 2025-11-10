import {
  type AllNode,
  type TransformOptions as BaseTransformOptions,
  type CommentNode,
  type CompilerCompatOptions,
  type ElementNode,
  ElementTypes,
  NodeTypes,
  type PlainElementNode,
  type RootNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
  defaultOnError,
  defaultOnWarn,
  getSelfName,
  isVSlot,
} from '@vue/compiler-dom'
import { EMPTY_OBJ, NOOP, extend, isArray, isString } from '@vue/shared'
import {
  type BlockIRNode,
  DynamicFlag,
  type HackOptions,
  type IRDynamicInfo,
  IRNodeTypes,
  type IRSlots,
  type OperationNode,
  type RootIRNode,
  type SetEventIRNode,
  type VaporDirectiveNode,
} from './ir'
import { isConstantExpression, isStaticExpression } from './utils'
import { newBlock, newDynamic } from './transforms/utils'
import type { ImportItem } from '@vue/compiler-core'

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
  handler?: boolean
  handlerModifiers?: SetEventIRNode['modifiers']
  model?: boolean
  modelModifiers?: string[]
}

// A structural directive transform is technically also a NodeTransform;
// Only v-if and v-for fall into this category.
export type StructuralDirectiveTransform = (
  node: ElementNode,
  dir: VaporDirectiveNode,
  context: TransformContext<ElementNode>,
) => void | (() => void)

export type TransformOptions = HackOptions<BaseTransformOptions>

const generatedVarRE = /^[nxr](\d+)$/

export class TransformContext<T extends AllNode = AllNode> {
  selfName: string | null = null
  parent: TransformContext<RootNode | ElementNode> | null = null
  root: TransformContext<RootNode>
  index: number = 0

  block: BlockIRNode = this.ir.block
  options: Required<
    Omit<TransformOptions, 'filename' | keyof CompilerCompatOptions>
  >

  template: string = ''
  childrenTemplate: (string | null)[] = []
  dynamic: IRDynamicInfo = this.ir.block.dynamic
  imports: ImportItem[] = []

  inVOnce: boolean = false
  inVFor: number = 0
  comment: CommentNode[] = []
  component: Set<string> = this.ir.component
  directive: Set<string> = this.ir.directive

  slots: IRSlots[] = []

  private globalId = 0
  private nextIdMap: Map<number, number> | null = null

  constructor(
    public ir: RootIRNode,
    public node: T,
    options: TransformOptions = {},
  ) {
    this.options = extend({}, defaultOptions, options)
    this.root = this as TransformContext<RootNode>
    if (options.filename) this.selfName = getSelfName(options.filename)
    this.initNextIdMap()
  }

  enterBlock(ir: BlockIRNode, isVFor: boolean = false): () => void {
    const { block, template, dynamic, childrenTemplate, slots } = this
    this.block = ir
    this.dynamic = ir.dynamic
    this.template = ''
    this.childrenTemplate = []
    this.slots = []
    isVFor && this.inVFor++
    return () => {
      // exit
      this.registerTemplate()
      this.block = block
      this.template = template
      this.dynamic = dynamic
      this.childrenTemplate = childrenTemplate
      this.slots = slots
      isVFor && this.inVFor--
    }
  }

  increaseId = (): number => {
    // allocate an id that won't conflict with user-defined bindings when used
    // as generated identifiers with n/x/r prefixes (e.g., n1, x1, r1).
    const id = getNextId(this.nextIdMap, this.globalId)
    // advance next
    this.globalId = getNextId(this.nextIdMap, id + 1)
    return id
  }

  private initNextIdMap(): void {
    const binding = this.root.options.bindingMetadata
    if (!binding) return

    const keys = Object.keys(binding)
    if (keys.length === 0) return

    // extract numbers for specific literal prefixes
    const numbers = new Set<number>()
    for (const name of keys) {
      const m = generatedVarRE.exec(name)
      if (m) numbers.add(Number(m[1]))
    }
    if (numbers.size === 0) return

    this.globalId = getNextId((this.nextIdMap = buildNextIdMap(numbers)), 0)
  }
  reference(): number {
    if (this.dynamic.id !== undefined) return this.dynamic.id
    this.dynamic.flags |= DynamicFlag.REFERENCED
    return (this.dynamic.id = this.increaseId())
  }

  pushTemplate(content: string): number {
    const existingIndex = this.ir.templateIndexMap.get(content)
    if (existingIndex !== undefined) {
      return existingIndex
    }

    const newIndex = this.ir.template.size
    this.ir.template.set(content, (this.node as PlainElementNode).ns)
    this.ir.templateIndexMap.set(content, newIndex)
    return newIndex
  }
  registerTemplate(): number {
    if (!this.template) return -1
    const id = this.pushTemplate(this.template)
    return (this.dynamic.template = id)
  }

  registerEffect(
    expressions: SimpleExpressionNode[],
    operation: OperationNode | OperationNode[],
    getIndex = (): number => this.block.effect.length,
  ): void {
    const operations = [operation].flat()
    expressions = expressions.filter(exp => !isConstantExpression(exp))
    if (
      this.inVOnce ||
      expressions.length === 0 ||
      expressions.every(e =>
        isStaticExpression(e, this.root.options.bindingMetadata),
      )
    ) {
      return this.registerOperation(...operations)
    }

    this.block.effect.splice(getIndex(), 0, {
      expressions,
      operations,
    })
  }

  registerOperation(...node: OperationNode[]): void {
    this.block.operation.push(...node)
  }

  create<T extends TemplateChildNode>(
    node: T,
    index: number,
  ): TransformContext<T> {
    return Object.assign(Object.create(TransformContext.prototype), this, {
      node,
      parent: this as any,
      index,

      template: '',
      childrenTemplate: [],
      dynamic: newDynamic(),
    } satisfies Partial<TransformContext<T>>)
  }
}

const defaultOptions = {
  filename: '',
  prefixIdentifiers: true,
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

// AST -> IR
export function transform(
  node: RootNode,
  options: TransformOptions = {},
): RootIRNode {
  const ir: RootIRNode = {
    type: IRNodeTypes.ROOT,
    node,
    source: node.source,
    template: new Map<string, number>(),
    templateIndexMap: new Map<string, number>(),
    component: new Set(),
    directive: new Set(),
    block: newBlock(node),
    hasTemplateRef: false,
  }

  const context = new TransformContext(ir, node, options)

  transformNode(context)

  ir.node.imports = context.imports

  return ir
}

export function transformNode(
  context: TransformContext<RootNode | TemplateChildNode>,
): void {
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

/**
 * Build a "next-id" map from an occupied number set.
 * For each consecutive range [start..end], map every v in the range to end + 1.
 * Example: input [0, 1, 2, 4] => { 0: 3, 1: 3, 2: 3, 4: 5 }.
 */
export function buildNextIdMap(nums: Iterable<number>): Map<number, number> {
  const map: Map<number, number> = new Map()
  const arr = Array.from(new Set(nums)).sort((a, b) => a - b)
  if (arr.length === 0) return map

  for (let i = 0; i < arr.length; i++) {
    let start = arr[i]
    let end = start
    while (i + 1 < arr.length && arr[i + 1] === end + 1) {
      i++
      end = arr[i]
    }
    for (let v = start; v <= end; v++) map.set(v, end + 1)
  }
  return map
}

/**
 * Return the available id for n using a map built by buildNextIdMap:
 * - If n is not occupied, return n.
 * - If n is occupied, return the mapped value
 */
export function getNextId(
  map: Map<number, number> | null | undefined,
  n: number,
): number {
  if (map && map.has(n)) return map.get(n)!
  return n
}
