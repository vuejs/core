import type {
  CodegenOptions as BaseCodegenOptions,
  BaseCodegenResult,
} from '@vue/compiler-dom'
import type { IREffect, RootIRNode, VaporHelper } from './ir'
import { SourceMapGenerator } from 'source-map-js'
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
  genCall,
  genCodeFragment,
} from './generators/utils'

export type CodegenOptions = Omit<BaseCodegenOptions, 'optimizeImports'>

export class CodegenContext {
  options: Required<CodegenOptions>

  code: CodeFragment[]
  map?: SourceMapGenerator
  push: (...args: CodeFragment[]) => void

  helpers = new Set<string>([])
  vaporHelpers = new Set<string>([])
  helper = (name: string) => {
    this.helpers.add(name)
    return `_${name}`
  }
  vaporHelper = (name: VaporHelper) => {
    this.vaporHelpers.add(name)
    return `_${name}`
  }

  delegates = new Set<string>()

  identifiers: Record<string, string[]> = Object.create(null)
  withId = <T>(fn: () => T, map: Record<string, string | null>): T => {
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
  genEffect?: (effects: IREffect[]) => CodeFragment[]

  constructor(
    public ir: RootIRNode,
    options: CodegenOptions,
  ) {
    const defaultOptions: Required<CodegenOptions> = {
      mode: 'function', // TODO
      prefixIdentifiers: options.mode === 'module',
      sourceMap: false,
      filename: `template.vue.html`,
      scopeId: null,
      runtimeGlobalName: `Vue`,
      runtimeModuleName: `vue`,
      vaporRuntimeModuleName: 'vue/vapor',
      ssrRuntimeModuleName: 'vue/server-renderer',
      ssr: false,
      isTS: false,
      inSSR: false,
      inline: false,
      bindingMetadata: {},
      expressionPlugins: [],
    }
    this.options = extend(defaultOptions, options)

    const [code, push] = buildCodeFragment()
    this.code = code
    this.push = push

    const {
      options: { filename, sourceMap },
    } = this
    if (!__BROWSER__ && sourceMap) {
      // lazy require source-map implementation, only in non-browser builds
      this.map = new SourceMapGenerator()
      this.map.setSourceContent(filename, ir.source)
      this.map._sources.add(filename)
    }
  }
}

export interface VaporCodegenResult extends BaseCodegenResult {
  ast: RootIRNode
  helpers: Set<string>
  vaporHelpers: Set<string>
}

// IR -> JS codegen
export function generate(
  ir: RootIRNode,
  options: CodegenOptions = {},
): VaporCodegenResult {
  const context = new CodegenContext(ir, options)
  const { push, helpers, vaporHelpers } = context

  const functionName = 'render'
  const isSetupInlined = options.inline
  if (isSetupInlined) {
    push(`(() => {`)
  } else {
    push(NEWLINE, `export function ${functionName}(_ctx) {`)
  }

  push(INDENT_START)
  push(...genBlockContent(ir.block, context))
  push(INDENT_END, NEWLINE)

  if (isSetupInlined) {
    push('})()')
  } else {
    push('}')
  }

  const deligates = genDeligates(context)
  // TODO source map?
  const templates = genTemplates(ir.template, context)
  const imports = genHelperImports(context)
  const preamble = imports + templates + deligates

  const newlineCount = [...preamble].filter(c => c === '\n').length
  if (newlineCount && !isSetupInlined) {
    context.code.unshift(...new Array<CodeFragment>(newlineCount).fill(LF))
  }

  let codegen = genCodeFragment(context)
  if (!isSetupInlined) {
    codegen = preamble + codegen
  }

  return {
    code: codegen,
    ast: ir,
    preamble,
    map: context.map ? context.map.toJSON() : undefined,
    helpers,
    vaporHelpers,
  }
}

function genDeligates({ delegates, vaporHelper }: CodegenContext) {
  return delegates.size
    ? genCall(
        vaporHelper('delegateEvents'),
        ...Array.from(delegates).map(v => `"${v}"`),
      ).join('') + '\n'
    : ''
}

function genHelperImports({ helpers, vaporHelpers, options }: CodegenContext) {
  let imports = ''
  if (helpers.size) {
    imports += `import { ${[...helpers]
      .map(h => `${h} as _${h}`)
      .join(', ')} } from '${options.runtimeModuleName}';\n`
  }
  if (vaporHelpers.size) {
    imports += `import { ${[...vaporHelpers]
      .map(h => `${h} as _${h}`)
      .join(', ')} } from '${options.vaporRuntimeModuleName}';\n`
  }
  return imports
}
