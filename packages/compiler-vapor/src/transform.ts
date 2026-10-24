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
  findDir,
  getSelfName,
  isCommentOrWhitespace,
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
  type IfIRNode,
  type OperationNode,
  type RootIRNode,
  type SetEventIRNode,
  TemplateRegistry,
  type VaporDirectiveNode,
  isBlockOperation,
} from './ir'
import {
  getIfChainLength,
  isBuiltInComponent,
  isConstantBinding,
  isConstantExpression,
  isKeepAliveTag,
  isLongIfChain,
  isSlotTemplate,
  isTransitionNode,
} from './utils'
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
  toDisplayString?: boolean
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

interface ChildContextInfo {
  node: AllNode
  hasSingleRootChild: boolean
  // a component's default slot body: its children minus the slot templates
  hasSingleSlotRootChild: boolean
  isLastEffectiveChild: boolean[]
}

export class TransformContext<T extends AllNode = AllNode> {
  ir: RootIRNode
  node: T
  selfName: string | null
  parent: TransformContext<RootNode | ElementNode> | null
  // cached parent that skips template tags
  effectiveParent: TransformContext<RootNode | ElementNode> | null
  root: TransformContext<RootNode>
  index: number

  block: BlockIRNode
  options: Required<
    Omit<TransformOptions, 'filename' | keyof CompilerCompatOptions>
  >

  template: string
  templateRoot: boolean
  templateIndexMap: Map<string, number>
  childrenTemplate: (string | null)[]
  dynamic: IRDynamicInfo
  imports: ImportItem[]

  inVOnce: boolean
  inVFor: number
  comment: CommentNode[]
  component: Set<string>
  directive: Set<string>

  slots: IRSlots[]

  effectIndex: number
  operationIndex: number

  // whether this node is the last effective child of its parent
  // (all siblings after it are components, which don't appear in HTML template)
  isLastEffectiveChild: boolean
  // whether this node is on the rightmost path of the tree
  // (all ancestors are also last effective children)
  isOnRightmostPath: boolean
  // whether this node is the component/template root
  isSingleRoot: boolean
  // whether this node is the single root of a slot body
  isSlotRoot: boolean
  // If an ancestor in the same template must close explicitly, descendants
  // with matching tags must also close so the browser doesn't consume the
  // ancestor close tag for the descendant.
  templateCloseTags: Set<string> | undefined
  // An ancestor with an explicit close tag that cannot pop an open special
  // descendant (any other end tag, formatting elements) also requires special
  // descendants in the same template to close explicitly.
  templateCloseBlocks: boolean
  // Whether the element is written into its parent's template and what that
  // template leaves open above it (`OpenScope` bits); 0 when it starts a
  // template of its own.
  templateScope: number

  // root-only state, read through `this.root`
  private globalId: number
  private nextIdMap: Map<number, number> | null
  private ifIndex: number
  // every `v-if` head with whether it sits in `v-once`; chains that grow past
  // IF_CHAIN_THRESHOLD get their key range reserved once the tree is done
  ifHeads: Map<IfIRNode, boolean>
  private childInfo: ChildContextInfo | null

  // Root and child contexts assign the same fields in the same order so they
  // share one hidden class; a child copied from its parent with
  // `Object.assign` lands in dictionary mode instead.
  constructor(
    ir: RootIRNode,
    node: T,
    options: TransformOptions = EMPTY_OBJ,
    parent: TransformContext<RootNode | ElementNode> | null = null,
    index: number = 0,
  ) {
    this.ir = ir
    this.node = node
    this.parent = parent
    this.index = index
    if (parent) {
      this.root = parent.root
      this.options = parent.options
      this.selfName = parent.selfName
      this.block = parent.block
      this.templateIndexMap = parent.templateIndexMap
      this.dynamic = newDynamic()
      this.imports = parent.imports
      // Slot content is executed by the child component, which re-runs it on
      // its own updates (vdom parity), so v-once does not reach into it.
      this.inVOnce = parent.inVOnce && !isComponentNode(parent.node)
      this.inVFor = parent.inVFor
      this.comment = parent.comment
      this.slots = parent.slots
      this.ifHeads = parent.ifHeads
      this.templateCloseTags = parent.templateCloseTags
      this.templateCloseBlocks = parent.templateCloseBlocks

      // find effectiveParent (skip template tags)
      let effectiveParent: TransformContext<RootNode | ElementNode> | null =
        parent
      while (
        effectiveParent &&
        effectiveParent.node.type === NodeTypes.ELEMENT &&
        (effectiveParent.node as ElementNode).tagType === ElementTypes.TEMPLATE
      ) {
        effectiveParent = effectiveParent.parent
      }
      this.effectiveParent = effectiveParent

      const childInfo = parent.getChildContextInfo()
      // compute whether this node is effectively the last child
      const isLastEffectiveChild = childInfo.isLastEffectiveChild[index]
      this.isLastEffectiveChild = isLastEffectiveChild
      this.isOnRightmostPath = parent.isOnRightmostPath && isLastEffectiveChild
      this.isSingleRoot = parent.isSingleRootChild(childInfo)
      this.isSlotRoot = parent.isSlotRootChild(childInfo)
    } else {
      this.root = this as TransformContext<RootNode>
      this.options = extend({}, defaultOptions, options)
      this.selfName = options.filename ? getSelfName(options.filename) : null
      this.block = ir.block
      this.templateIndexMap = new Map()
      this.dynamic = ir.block.dynamic
      this.imports = []
      this.inVOnce = false
      this.inVFor = 0
      this.comment = []
      this.slots = []
      this.ifHeads = new Map()
      this.templateCloseTags = undefined
      this.templateCloseBlocks = false
      this.effectiveParent = null
      this.isLastEffectiveChild = true
      this.isOnRightmostPath = true
      this.isSingleRoot = false
      this.isSlotRoot = false
    }
    this.template = ''
    this.templateRoot = false
    this.childrenTemplate = []
    this.component = ir.component
    this.directive = ir.directive
    this.effectIndex = this.block.effect.length
    this.operationIndex = this.block.operation.length
    this.templateScope = 0
    this.globalId = 0
    this.nextIdMap = null
    this.ifIndex = 0
    this.childInfo = null
    if (!parent) this.initNextIdMap()
  }

  enterBlock(ir: BlockIRNode, isVFor: boolean = false): () => void {
    const {
      block,
      template,
      templateRoot,
      templateIndexMap,
      dynamic,
      childrenTemplate,
      slots,
      effectIndex,
      operationIndex,
    } = this
    this.block = ir
    this.dynamic = ir.dynamic
    this.template = ''
    this.templateRoot = false
    this.templateIndexMap = templateIndexMap
    this.childrenTemplate = []
    this.slots = []
    this.effectIndex = ir.effect.length
    this.operationIndex = ir.operation.length
    isVFor && this.inVFor++
    return () => {
      // exit
      this.registerTemplate()
      this.block = block
      this.template = template
      this.templateRoot = templateRoot
      this.templateIndexMap = templateIndexMap
      this.dynamic = dynamic
      this.childrenTemplate = childrenTemplate
      this.slots = slots
      this.effectIndex = effectIndex
      this.operationIndex = operationIndex
      isVFor && this.inVFor--
    }
  }

  increaseId(): number {
    const root = this.root
    // allocate an id that won't conflict with user-defined bindings when used
    // as generated identifiers with n/x/r prefixes (e.g., n1, x1, r1).
    const id = getNextId(root.nextIdMap, root.globalId)
    // advance next
    root.globalId = getNextId(root.nextIdMap, id + 1)
    return id
  }

  private initNextIdMap(): void {
    const binding = this.options.bindingMetadata
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

  nextIfIndex(count = 1): number {
    const root = this.root
    const index = root.ifIndex
    root.ifIndex += count
    return index
  }

  private getTemplateNamespace(): number {
    return this.node.type === NodeTypes.ELEMENT ? this.node.ns : 0
  }

  private canUseStaticTemplate(): boolean {
    if (!this.template) return false
    if (this.inVFor) return false
    if (this.dynamic.hasDynamicChild) return false
    if (this.block.effect.length !== this.effectIndex) return false
    if (this.block.operation.length !== this.operationIndex) return false

    if (
      this.node.type === NodeTypes.TEXT ||
      this.node.type === NodeTypes.COMMENT
    ) {
      return true
    }

    return (
      this.node.type === NodeTypes.ELEMENT &&
      this.node.tagType === ElementTypes.ELEMENT &&
      !(
        this.options.isCustomElement(this.node.tag) ||
        this.node.tag === 'template'
      )
    )
  }

  pushTemplate(
    content: string,
    {
      root = false,
      static: isStatic = false,
    }: {
      root?: boolean
      static?: boolean
    } = {},
  ): number {
    const templateKey = JSON.stringify([
      this.getTemplateNamespace(),
      root,
      isStatic,
      content,
    ])
    const existingIndex = this.templateIndexMap.get(templateKey)
    if (existingIndex !== undefined) {
      return existingIndex
    }

    const ns = this.getTemplateNamespace()
    const newIndex = this.ir.template.entries.length
    this.ir.template.entries.push({ content, ns, root, static: isStatic })
    this.templateIndexMap.set(templateKey, newIndex)
    return newIndex
  }
  registerTemplate(): number {
    if (!this.template) return -1
    const id = this.pushTemplate(this.template, {
      root: this.templateRoot,
      static: this.canUseStaticTemplate(),
    })
    return (this.dynamic.template = id)
  }

  registerEffect(
    expressions: SimpleExpressionNode[],
    operation: OperationNode | OperationNode[],
    getIndex?: () => number,
    preserveOrder = false,
  ): boolean {
    const operations = [operation].flat()
    expressions = expressions.filter(
      exp => !isConstantExpression(exp, this.root.options.bindingMetadata),
    )
    const once = expressions.every(e =>
      isConstantBinding(e, this.root.options.bindingMetadata),
    )
    // Merged listeners use effect cleanup even when their props are constant.
    const needsEffect = operations.some(
      op => op.type === IRNodeTypes.SET_DYNAMIC_PROPS && op.listeners,
    )
    if (this.inVOnce || (once && !preserveOrder && !needsEffect)) {
      this.registerOperation(...operations)
      return false
    }

    const index = getIndex ? getIndex() : this.block.effect.length
    this.block.effect.splice(index, 0, {
      expressions,
      operations,
      ...(once && !needsEffect ? { once: true } : {}),
    })
    if (getIndex) {
      this.shiftEffectBoundaries(index)
    }
    return true
  }

  registerOperation(...node: OperationNode[]): void {
    this.block.operation.push(...node)
  }

  effectBoundary(): { operationIndex: number; effectIndex: number } {
    return {
      operationIndex: this.operationIndex,
      effectIndex: this.effectIndex,
    }
  }

  create<T extends TemplateChildNode>(
    node: T,
    index: number,
  ): TransformContext<T> {
    return new TransformContext(
      this.ir,
      node,
      EMPTY_OBJ,
      this as TransformContext<RootNode | ElementNode>,
      index,
    )
  }

  private shiftEffectBoundaries(
    index: number,
    dynamic: IRDynamicInfo = this.dynamic,
  ): void {
    const operation = dynamic.operation
    if (
      operation &&
      isBlockOperation(operation) &&
      operation.effectIndex !== undefined &&
      operation.effectIndex >= index
    ) {
      operation.effectIndex++
    }

    for (const child of dynamic.children) {
      this.shiftEffectBoundaries(index, child)
    }
  }

  private getChildContextInfo(): ChildContextInfo {
    const node = this.node
    if (node.type !== NodeTypes.ROOT && node.type !== NodeTypes.ELEMENT) {
      return {
        node,
        hasSingleRootChild: true,
        hasSingleSlotRootChild: false,
        isLastEffectiveChild: [],
      }
    }

    const cached = this.childInfo
    if (cached && cached.node === node) {
      return cached
    }

    const { children } = node
    const isLastEffectiveChild = new Array<boolean>(children.length)
    let hasFollowingEffectiveChild = false
    for (let i = children.length - 1; i >= 0; i--) {
      isLastEffectiveChild[i] = !hasFollowingEffectiveChild
      if (!isComponentChild(children[i])) {
        hasFollowingEffectiveChild = true
      }
    }

    const hasSingleRoot = hasSingleRootChild(children)
    const childInfo = {
      node,
      hasSingleRootChild: hasSingleRoot,
      hasSingleSlotRootChild:
        node.type === NodeTypes.ELEMENT &&
        node.tagType === ElementTypes.COMPONENT &&
        !isBuiltInComponent(node.tag) &&
        (children.some(isSlotTemplate)
          ? hasSingleRootChild(children.filter(child => !isSlotTemplate(child)))
          : hasSingleRoot),
      isLastEffectiveChild,
    }
    this.childInfo = childInfo
    return childInfo
  }

  // The direct content of a component (its default slot body, built-ins
  // aside) or of a slot template, or a v-if branch of either. A v-for wrapper
  // makes rows, and a slot outlet's fallback does not count (see
  // transformSlotOutlet).
  private isSlotRootChild(childInfo: ChildContextInfo): boolean {
    const node = this.node
    if (node.type !== NodeTypes.ELEMENT) return false
    if (node.tagType === ElementTypes.COMPONENT) {
      return childInfo.hasSingleSlotRootChild
    }
    return (
      node.tagType === ElementTypes.TEMPLATE &&
      childInfo.hasSingleRootChild &&
      (isSlotTemplate(node) || (this.isSlotRoot && !findDir(node, 'for')))
    )
  }

  private isSingleRootChild(childInfo: ChildContextInfo): boolean {
    if (!childInfo.hasSingleRootChild) {
      return false
    }

    const node = this.node
    if (node.type === NodeTypes.ROOT) {
      return true
    }
    if (node.type !== NodeTypes.ELEMENT || !this.parent) {
      return false
    }
    // a v-for row is never the host's root, but the cut only applies to the
    // wrapper between them, not to a v-for above a built-in
    if (node.tagType === ElementTypes.TEMPLATE) {
      return this.isSingleRoot && !findDir(node, 'for')
    }
    // Transition / KeepAlive pass their attrs through to their single child
    // wherever they sit, so the child layers fallthrough class / style like
    // a component root does
    return isTransitionNode(node) || isKeepAliveTag(node.tag)
  }
}

function hasSingleRootChild(children: TemplateChildNode[]): boolean {
  let nonCommentChildren = 0
  let hasEncounteredIf = false
  let isSingleIfBlock = true

  for (const child of children) {
    if (isCommentOrWhitespace(child)) {
      continue
    }

    nonCommentChildren++
    if (isIfChild(child)) {
      if (hasEncounteredIf) {
        isSingleIfBlock = false
      }
      hasEncounteredIf = true
    } else if (!hasEncounteredIf || !isElseChild(child)) {
      isSingleIfBlock = false
    }
  }

  return nonCommentChildren === 1 || isSingleIfBlock
}

function isComponentChild(child: TemplateChildNode): boolean {
  return (
    child.type === NodeTypes.ELEMENT && child.tagType === ElementTypes.COMPONENT
  )
}

function isIfChild(child: TemplateChildNode): boolean {
  return (
    child.type === NodeTypes.IF ||
    (child.type === NodeTypes.ELEMENT && !!findDir(child, 'if'))
  )
}

function isElseChild(child: TemplateChildNode): boolean {
  return (
    child.type === NodeTypes.ELEMENT && !!findDir(child, /^else(-if)?$/, true)
  )
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
    template: new TemplateRegistry(),
    component: new Set(),
    directive: new Set(),
    block: newBlock(node),
    hasTemplateRef: false,
  }

  const context = new TransformContext(ir, node, options)

  transformNode(context)
  finalizeIfChains(context)

  ir.node.imports = context.imports

  return ir
}

// A long chain renders as one keyed fragment: its selection is frozen only by
// `v-once` on the head, and its branch keys are consecutive, so the range is
// reserved after every `v-else-if` has joined (indexes handed out in between
// to nested `v-if`s are left as gaps).
function finalizeIfChains(context: TransformContext<RootNode>): void {
  context.ifHeads.forEach((inVOnce, head) => {
    if (!isLongIfChain(head)) return
    head.once = inVOnce
    if (!inVOnce) {
      // one index covers two keys; the chain keys every branch plus the empty
      // state past the last one
      head.index = context.nextIfIndex(
        Math.ceil((getIfChainLength(head) + 1) / 2),
      )
    }
  })
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

export function isComponentNode(node: AllNode): boolean {
  return (
    node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.COMPONENT
  )
}
