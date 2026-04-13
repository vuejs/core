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

const idWithTrailingDigitsRE = /^([A-Za-z_$][\w$]*)(\d+)$/

export class CodegenContext {
  options: Required<CodegenOptions>

  bindingNames: Set<string> = new Set<string>()

  helpers: Map<string, string> = new Map()

  helper = (name: CoreHelper | VaporHelper): string => {
    if (this.helpers.has(name)) {
      return this.helpers.get(name)!
    }

    const base = `_${name}`
    if (this.bindingNames.size === 0 || !this.bindingNames.has(base)) {
      this.helpers.set(name, base)
      return base
    }

    const map = this.nextIdMap.get(base)
    // start from 1 because "base" (no suffix) is already taken.
    const alias = `${base}${getNextId(map, 1)}`
    this.helpers.set(name, alias)
    return alias
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
  private lastIdMap: Map<string, number> = new Map()
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
  const templates = genTemplates(ir.template, ir.rootTemplateIndexes, context)
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
