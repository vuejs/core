import type {
  CodegenOptions as BaseCodegenOptions,
  BaseCodegenResult,
  SimpleExpressionNode,
} from '@vue/compiler-dom'
import type {
  BlockIRNode,
  CoreHelper,
  IRDynamicInfo,
  RootIRNode,
  SetTemplateRefIRNode,
  VaporHelper,
} from './ir'
import { DynamicFlag, IRNodeTypes } from './ir'
import { extend, remove } from '@vue/shared'
import { genBlockContent } from './generators/block'
import { genTemplates } from './generators/template'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  LF,
  NEWLINE,
  buildCodeFragment,
  codeFragmentToString,
  genCall,
} from './generators/utils'
import { setTemplateRefIdent } from './generators/templateRef'
import { buildNextIdMap, getNextId } from './transform'

export type CodegenOptions = Omit<BaseCodegenOptions, 'optimizeImports'>

const idWithTrailingDigitsRE = /^([A-Za-z_$][\w$]*)(\d+)$/
const helperNameAliases: Record<string, string> = {
  withVaporKeys: 'withKeys',
  withVaporModifiers: 'withModifiers',
}

export class CodegenContext {
  options: Required<CodegenOptions>

  bindingNames: Set<string> = new Set<string>()

  helpers: Map<string, string> = new Map()

  needsTemplateRefSetter: boolean = false
  staticTemplateRefHelperCandidate?: SetTemplateRefIRNode
  staticTemplateRefBindingCandidate?: SetTemplateRefIRNode
  inSlotBlock: boolean = false

  helper = (name: CoreHelper | VaporHelper): string => {
    if (this.helpers.has(name)) {
      return this.helpers.get(name)!
    }

    const base = `_${helperNameAliases[name] || name}`
    if (this.isHelperNameAvailable(base)) {
      this.helpers.set(name, base)
      return base
    }

    const map = this.nextIdMap.get(base)
    let next = 1
    while (true) {
      // start from 1 because "base" (no suffix) is already taken.
      const alias = `${base}${getNextId(map, next)}`
      if (this.isHelperNameAvailable(alias)) {
        this.helpers.set(name, alias)
        return alias
      }
      next++
    }
  }

  delegates: Set<string> = new Set<string>()

  singleUseAssetComponentNames?: Set<string>

  identifiers: Record<string, (string | SimpleExpressionNode)[]> =
    Object.create(null)

  expressionReplacements: Map<SimpleExpressionNode, SimpleExpressionNode>[] = []

  withExpressionReplacements<T>(
    map: Map<SimpleExpressionNode, SimpleExpressionNode>,
    fn: () => T,
  ): T {
    if (map.size === 0) return fn()
    this.expressionReplacements.unshift(map)
    try {
      return fn()
    } finally {
      remove(this.expressionReplacements, map)
    }
  }

  getExpressionReplacement(node: SimpleExpressionNode): SimpleExpressionNode {
    for (const map of this.expressionReplacements) {
      const replacement = map.get(node)
      if (replacement) return replacement
    }
    return node
  }

  seenInlineHandlerNames: Record<string, number> = Object.create(null)

  block: BlockIRNode
  withId<T>(
    fn: () => T,
    map: Record<string, string | SimpleExpressionNode | null>,
  ): T {
    const { identifiers } = this
    const ids = Object.keys(map)

    for (const id of ids) {
      identifiers[id] ||= []
      identifiers[id].unshift(map[id] || id)
    }

    const ret = fn()
    ids.forEach(id => remove(identifiers[id], map[id] || id))

    return ret
  }

  enterBlock(block: BlockIRNode) {
    const parent = this.block
    this.block = block
    return (): BlockIRNode => (this.block = parent)
  }

  enterSlotBlock() {
    const parent = this.inSlotBlock
    this.inSlotBlock = true
    return (): boolean => (this.inSlotBlock = parent)
  }

  scopeLevel: number = 0
  enterScope(): [level: number, exit: () => number] {
    return [this.scopeLevel++, () => this.scopeLevel--] as const
  }

  private templateVars: Map<number, string> = new Map()
  private nextIdMap: Map<string, Map<number, number>> = new Map()
  private lastIdMap: Map<string, number> = new Map()
  private isHelperNameAvailable(name: string): boolean {
    if (this.bindingNames.has(name)) return false
    for (const alias of this.helpers.values()) {
      if (alias === name) return false
    }
    return true
  }

  private lastTIndex: number = -1
  private initNextIdMap(): void {
    if (this.bindingNames.size === 0) return

    // build a map of binding names to their occupied ids
    const map = new Map<string, Set<number>>()
    for (const name of this.bindingNames) {
      const m = idWithTrailingDigitsRE.exec(name)
      if (!m) continue

      const prefix = m[1]
      const num = Number(m[2])
      let set = map.get(prefix)
      if (!set) map.set(prefix, (set = new Set<number>()))
      set.add(num)
    }

    for (const [prefix, nums] of map) {
      this.nextIdMap.set(prefix, buildNextIdMap(nums))
    }
  }

  tName(i: number): string {
    let name = this.templateVars.get(i)
    if (name) return name

    const map = this.nextIdMap.get('t')
    let lastId = this.lastIdMap.get('t') || -1
    for (let j = this.lastTIndex + 1; j <= i; j++) {
      this.templateVars.set(
        j,
        (name = `t${(lastId = getNextId(map, Math.max(j, lastId + 1)))}`),
      )
    }
    this.lastIdMap.set('t', lastId)
    this.lastTIndex = i
    return name!
  }

  pName(i: number): string {
    const map = this.nextIdMap.get('p')
    let lastId = this.lastIdMap.get('p') || -1
    this.lastIdMap.set('p', (lastId = getNextId(map, Math.max(i, lastId + 1))))
    return `p${lastId}`
  }

  constructor(
    public ir: RootIRNode,
    options: CodegenOptions,
  ) {
    const defaultOptions: Required<CodegenOptions> = {
      mode: 'module',
      prefixIdentifiers: true,
      sourceMap: false,
      filename: `template.vue.html`,
      scopeId: null,
      runtimeGlobalName: `Vue`,
      runtimeModuleName: `vue`,
      ssrRuntimeModuleName: 'vue/server-renderer',
      ssr: false,
      isTS: false,
      inSSR: false,
      inline: false,
      bindingMetadata: {},
      expressionPlugins: [],
    }
    this.options = extend(defaultOptions, options)
    this.block = ir.block
    this.bindingNames = new Set<string>(
      this.options.bindingMetadata
        ? Object.keys(this.options.bindingMetadata)
        : [],
    )
    this.initNextIdMap()
    this.staticTemplateRefHelperCandidate = getStaticTemplateRefHelperCandidate(
      ir.block,
    )
    this.staticTemplateRefBindingCandidate =
      getStaticTemplateRefBindingCandidate(ir.block)
  }
}

export interface VaporCodegenResult extends BaseCodegenResult {
  ast: RootIRNode
  helpers: Set<string>
}

// IR -> JS codegen
export function generate(
  ir: RootIRNode,
  options: CodegenOptions = {},
): VaporCodegenResult {
  const [frag, push] = buildCodeFragment()
  const context = new CodegenContext(ir, options)
  const { inline, bindingMetadata } = options
  const functionName = 'render'

  const args = ['_ctx']
  if (bindingMetadata && !inline) {
    // binding optimization args
    args.push('$props', '$emit', '$attrs', '$slots')
  }
  const signature = (options.isTS ? args.map(arg => `${arg}: any`) : args).join(
    ', ',
  )

  if (!inline) {
    push(NEWLINE, `export function ${functionName}(${signature}) {`)
  }

  push(INDENT_START)
  // Pre-register to keep fallback template-ref helper ordering stable; remove it
  // below when all refs lower to binding helpers.
  const templateRefSetterHelper = ir.hasTemplateRef
    ? context.helper('createTemplateRefSetter')
    : undefined
  const body = genBlockContent(ir.block, context, true)
  if (context.needsTemplateRefSetter) {
    push(NEWLINE, `const ${setTemplateRefIdent} = ${templateRefSetterHelper}()`)
  } else if (templateRefSetterHelper) {
    context.helpers.delete('createTemplateRefSetter')
  }
  push(...body)
  push(INDENT_END, NEWLINE)

  if (!inline) {
    push('}')
  }

  const delegates = genDelegates(context)
  const templates = genTemplates(ir.template.entries, context)
  const imports = genHelperImports(context) + genAssetImports(context)
  const preamble = imports + templates + delegates

  const newlineCount = [...preamble].filter(c => c === '\n').length
  if (newlineCount && !inline) {
    frag.unshift(...new Array<CodeFragment>(newlineCount).fill(LF))
  }

  let [code, map] = codeFragmentToString(frag, context)
  if (!inline) {
    code = preamble + code
  }

  return {
    code,
    ast: ir,
    preamble,
    map: map && map.toJSON(),
    helpers: new Set<string>(Array.from(context.helpers.keys())),
  }
}

function genDelegates({ delegates, helper }: CodegenContext) {
  return delegates.size
    ? genCall(
        helper('delegateEvents'),
        ...Array.from(delegates).map(v => `"${v}"`),
      ).join('') + '\n'
    : ''
}

function genHelperImports({ helpers, options }: CodegenContext) {
  let imports = ''
  if (helpers.size) {
    imports += `import { ${Array.from(helpers)
      .map(([h, alias]) => `${h} as ${alias}`)
      .join(', ')} } from '${options.runtimeModuleName}';\n`
  }
  return imports
}

function genAssetImports({ ir }: CodegenContext) {
  const assetImports = ir.node.imports
  let imports = ''
  for (const assetImport of assetImports) {
    const exp = assetImport.exp
    const name = exp.content
    imports += `import ${name} from '${assetImport.path}';\n`
  }
  return imports
}

function getStaticTemplateRefHelperCandidate(
  block: BlockIRNode,
): SetTemplateRefIRNode | undefined {
  // setStaticTemplateRef skips dynamic setter hooks, so only use it for a
  // single static template DOM ref in the root block.
  if (block.effect.length || block.operation.length !== 1) return

  const operation = block.operation[0]
  if (
    operation.type === IRNodeTypes.SET_TEMPLATE_REF &&
    !operation.effect &&
    !operation.refFor &&
    canUseStaticTemplateRefHelper(block, operation)
  ) {
    return operation
  }
}

function getStaticTemplateRefBindingCandidate(
  block: BlockIRNode,
): SetTemplateRefIRNode | undefined {
  if (block.effect.length || block.operation.length !== 1) return

  const operation = block.operation[0]
  if (
    operation.type === IRNodeTypes.SET_TEMPLATE_REF &&
    !operation.effect &&
    !operation.refFor &&
    operation.value.isStatic &&
    !canUseStaticTemplateRefHelper(block, operation)
  ) {
    return operation
  }
}

function canUseStaticTemplateRefHelper(
  block: BlockIRNode,
  operation: SetTemplateRefIRNode,
): boolean {
  const dynamic = findDynamicInfo(block.dynamic, operation.element)
  return !!dynamic && !(dynamic.flags & DynamicFlag.NON_TEMPLATE)
}

function findDynamicInfo(
  dynamic: IRDynamicInfo,
  id: number,
): IRDynamicInfo | undefined {
  if (dynamic.id === id) return dynamic

  for (const child of dynamic.children) {
    const found = findDynamicInfo(child, id)
    if (found) return found
  }
}
