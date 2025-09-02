import type {
  CodegenOptions as BaseCodegenOptions,
  BaseCodegenResult,
  SimpleExpressionNode,
} from '@vue/compiler-dom'
import type { BlockIRNode, CoreHelper, RootIRNode, VaporHelper } from './ir'
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

const generatedVarRE = /^([pt])(\d+)$/

export class CodegenContext {
  options: Required<CodegenOptions>

  helpers: Set<string> = new Set<string>([])

  bindingNames: Set<string> = new Set<string>()

  helper = (name: CoreHelper | VaporHelper) => {
    this.helpers.add(name)
    return `_${name}`
  }

  delegates: Set<string> = new Set<string>()

  identifiers: Record<string, (string | SimpleExpressionNode)[]> =
    Object.create(null)

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

  scopeLevel: number = 0
  enterScope(): [level: number, exit: () => number] {
    return [this.scopeLevel++, () => this.scopeLevel--] as const
  }

  private templateVars: Map<number, string> = new Map()
  private nextIdMap: Map<string, Map<number, number>> = new Map()
  private lastPId: number = -1
  private lastTIndex: number = -1
  private lastTId: number = -1
  private initNextIdMap(): void {
    if (this.bindingNames.size === 0) return

    // build a map of binding names to their occupied ids
    const map = new Map<string, Set<number>>()
    for (const name of this.bindingNames) {
      const m = generatedVarRE.exec(name)
      if (!m) continue

      const prefix = m[1]
      const num = Number(m[2])
      let set = map.get(prefix)
      if (!set) map.set(prefix, (set = new Set<number>()))
      set.add(num)
    }

    for (const [prefix, nums] of map) {
      if (nums.size === 0) continue
      this.nextIdMap.set(prefix, buildNextIdMap(nums))
    }
  }
  tName(i: number): string {
    let name = this.templateVars.get(i)
    if (name) return name

    const map = this.nextIdMap.get('t')
    for (let j = this.lastTIndex + 1; j <= i; j++) {
      this.templateVars.set(
        j,
        `t${(this.lastTId = getNextId(map, Math.max(j, this.lastTId + 1)))}`,
      )
    }
    this.lastTIndex = i
    return this.templateVars.get(i)!
  }

  pName(i: number): string {
    const map = this.nextIdMap.get('p')
    return `p${(this.lastPId = getNextId(map, Math.max(i, this.lastPId + 1)))}`
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
  const { helpers } = context
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
  if (ir.hasTemplateRef) {
    push(
      NEWLINE,
      `const ${setTemplateRefIdent} = ${context.helper('createTemplateRefSetter')}()`,
    )
  }
  push(...genBlockContent(ir.block, context, true))
  push(INDENT_END, NEWLINE)

  if (!inline) {
    push('}')
  }

  const delegates = genDelegates(context)
  const templates = genTemplates(ir.template, ir.rootTemplateIndex, context)
  const imports = genHelperImports(context)
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
    helpers,
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

function genHelperImports({ helpers, helper, options }: CodegenContext) {
  let imports = ''
  if (helpers.size) {
    imports += `import { ${[...helpers]
      .map(h => `${h} as _${h}`)
      .join(', ')} } from '${options.runtimeModuleName}';\n`
  }
  return imports
}
