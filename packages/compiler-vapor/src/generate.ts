import {
  type CodegenOptions as BaseCodegenOptions,
  type BaseCodegenResult,
  NewlineType,
  type Position,
  type SourceLocation,
  advancePositionWithMutation,
  locStub,
} from '@vue/compiler-dom'
import {
  type BlockFunctionIRNode,
  DynamicFlag,
  type IRDynamicInfo,
  IRNodeTypes,
  type OperationNode,
  type RootIRNode,
  type VaporHelper,
  type WithDirectiveIRNode,
} from './ir'
import { SourceMapGenerator } from 'source-map-js'
import { extend, isString } from '@vue/shared'
import type { ParserPlugin } from '@babel/parser'
import { genSetProp } from './generators/prop'
import { genCreateTextNode, genSetText } from './generators/text'
import { genSetEvent } from './generators/event'
import { genSetHtml } from './generators/html'
import { genSetRef } from './generators/ref'
import { genSetModelValue } from './generators/modelValue'
import { genAppendNode, genInsertNode, genPrependNode } from './generators/dom'
import { genWithDirective } from './generators/directive'
import { genIf } from './generators/if'
import { genTemplate } from './generators/template'

interface CodegenOptions extends BaseCodegenOptions {
  expressionPlugins?: ParserPlugin[]
}

// remove when stable
// @ts-expect-error
function checkNever(x: never): never {}

export type CodeFragment =
  | string
  | [code: string, newlineIndex?: number, loc?: SourceLocation, name?: string]
  | undefined

export interface CodegenContext {
  options: Required<CodegenOptions>

  source: string
  code: CodeFragment[]
  indentLevel: number
  map?: SourceMapGenerator

  push(...args: CodeFragment[]): void
  newline(): CodeFragment
  multi(
    codes: [left: string, right: string, segment: string],
    ...fn: Array<false | string | CodeFragment[]>
  ): CodeFragment[]
  call(
    name: string,
    ...args: Array<false | string | CodeFragment[]>
  ): CodeFragment[]
  withIndent<T>(fn: () => T): T

  helpers: Set<string>
  vaporHelpers: Set<string>
  helper(name: string): string
  vaporHelper(name: string): string
}

function createCodegenContext(ir: RootIRNode, options: CodegenOptions) {
  const helpers = new Set<string>([])
  const vaporHelpers = new Set<string>([])
  const [code, push] = buildCodeFragment()
  const context: CodegenContext = {
    options: extend(
      {
        mode: 'function',
        prefixIdentifiers: options.mode === 'module',
        sourceMap: false,
        filename: `template.vue.html`,
        scopeId: null,
        optimizeImports: false,
        runtimeGlobalName: `Vue`,
        runtimeModuleName: `vue`,
        ssrRuntimeModuleName: 'vue/server-renderer',
        ssr: false,
        isTS: false,
        inSSR: false,
        inline: false,
        bindingMetadata: {},
        expressionPlugins: [],
      },
      options,
    ),

    source: ir.source,
    code,
    indentLevel: 0,

    helpers,
    vaporHelpers,
    helper(name: string) {
      helpers.add(name)
      return `_${name}`
    },
    vaporHelper(name: VaporHelper) {
      vaporHelpers.add(name)
      return `_${name}`
    },

    push,
    newline() {
      return [`\n${`  `.repeat(context.indentLevel)}`, NewlineType.Start]
    },
    multi([left, right, seg], ...fns) {
      const frag: CodeFragment[] = []
      fns = fns.filter(Boolean)
      frag.push(left)
      for (let [i, fn] of fns.entries()) {
        if (fn) {
          if (isString(fn)) fn = [fn]
          frag.push(...fn)
          if (i < fns.length - 1) frag.push(seg)
        }
      }
      frag.push(right)
      return frag
    },
    call(name, ...args) {
      return [name, ...context.multi(['(', ')', ', '], ...args)]
    },
    withIndent(fn) {
      ++context.indentLevel
      const ret = fn()
      --context.indentLevel
      return ret
    },
  }

  const filename = context.options.filename
  if (!__BROWSER__ && context.options.sourceMap) {
    // lazy require source-map implementation, only in non-browser builds
    context.map = new SourceMapGenerator()
    context.map.setSourceContent(filename, context.source)
    context.map._sources.add(filename)
  }

  return context
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
  const ctx = createCodegenContext(ir, options)
  const { push, withIndent, newline, helpers, vaporHelpers } = ctx

  const functionName = 'render'
  const isSetupInlined = !!options.inline
  if (isSetupInlined) {
    push(`(() => {`)
  } else {
    push(
      // placeholder for preamble
      newline(),
      newline(),
      `export function ${functionName}(_ctx) {`,
    )
  }

  withIndent(() => {
    ir.template.forEach((template, i) => push(...genTemplate(template, i, ctx)))
    push(...genBlockFunctionContent(ir, ctx))
  })

  push(newline())
  if (isSetupInlined) {
    push('})()')
  } else {
    push('}')
  }

  let preamble = ''
  if (vaporHelpers.size)
    // TODO: extract import codegen
    preamble = `import { ${[...vaporHelpers]
      .map(h => `${h} as _${h}`)
      .join(', ')} } from 'vue/vapor';`
  if (helpers.size)
    preamble = `import { ${[...helpers]
      .map(h => `${h} as _${h}`)
      .join(', ')} } from 'vue';`

  let codegen = genCodeFragment(ctx)
  if (!isSetupInlined) {
    codegen = preamble + codegen
  }

  return {
    code: codegen,
    ast: ir,
    preamble,
    map: ctx.map ? ctx.map.toJSON() : undefined,
    helpers,
    vaporHelpers,
  }
}

function genCodeFragment(context: CodegenContext) {
  let codegen = ''
  let line = 1
  let column = 1
  let offset = 0

  for (let frag of context.code) {
    if (!frag) continue
    if (isString(frag)) frag = [frag]

    let [code, newlineIndex = NewlineType.None, loc, name] = frag
    codegen += code

    if (!__BROWSER__ && context.map) {
      if (loc) addMapping(loc.start, name)
      if (newlineIndex === NewlineType.Unknown) {
        // multiple newlines, full iteration
        advancePositionWithMutation({ line, column, offset }, code)
      } else {
        // fast paths
        offset += code.length
        if (newlineIndex === NewlineType.None) {
          // no newlines; fast path to avoid newline detection
          if (__TEST__ && code.includes('\n')) {
            throw new Error(
              `CodegenContext.push() called newlineIndex: none, but contains` +
                `newlines: ${code.replace(/\n/g, '\\n')}`,
            )
          }
          column += code.length
        } else {
          // single newline at known index
          if (newlineIndex === NewlineType.End) {
            newlineIndex = code.length - 1
          }
          if (
            __TEST__ &&
            (code.charAt(newlineIndex) !== '\n' ||
              code.slice(0, newlineIndex).includes('\n') ||
              code.slice(newlineIndex + 1).includes('\n'))
          ) {
            throw new Error(
              `CodegenContext.push() called with newlineIndex: ${newlineIndex} ` +
                `but does not conform: ${code.replace(/\n/g, '\\n')}`,
            )
          }
          line++
          column = code.length - newlineIndex
        }
      }
      if (loc && loc !== locStub) {
        addMapping(loc.end)
      }
    }
  }

  return codegen

  function addMapping(loc: Position, name: string | null = null) {
    // we use the private property to directly add the mapping
    // because the addMapping() implementation in source-map-js has a bunch of
    // unnecessary arg and validation checks that are pure overhead in our case.
    const { _names, _mappings } = context.map!
    if (name !== null && !_names.has(name)) _names.add(name)
    _mappings.add({
      originalLine: loc.line,
      originalColumn: loc.column - 1, // source-map column is 0 based
      generatedLine: line,
      generatedColumn: column - 1,
      source: context.options.filename,
      // @ts-expect-error it is possible to be null
      name,
    })
  }
}

function genChildren(children: IRDynamicInfo[]) {
  let code = ''
  let offset = 0

  for (const [index, child] of children.entries()) {
    if (child.dynamicFlags & DynamicFlag.NON_TEMPLATE) {
      offset--
    }

    const idx = Number(index) + offset
    const id =
      child.dynamicFlags & DynamicFlag.REFERENCED
        ? child.dynamicFlags & DynamicFlag.INSERT
          ? child.anchor
          : child.id
        : null
    const childrenString = genChildren(child.children)

    if (id !== null || childrenString) {
      code += ` ${idx}: [`
      if (id !== null) code += `n${id}`
      if (childrenString) code += `, ${childrenString}`
      code += '],'
    }
  }

  if (!code) return ''
  return `{${code}}`
}

function genOperation(
  oper: OperationNode,
  context: CodegenContext,
): CodeFragment[] {
  // TODO: cache old value
  switch (oper.type) {
    case IRNodeTypes.SET_PROP:
      return genSetProp(oper, context)
    case IRNodeTypes.SET_TEXT:
      return genSetText(oper, context)
    case IRNodeTypes.SET_EVENT:
      return genSetEvent(oper, context)
    case IRNodeTypes.SET_HTML:
      return genSetHtml(oper, context)
    case IRNodeTypes.SET_REF:
      return genSetRef(oper, context)
    case IRNodeTypes.SET_MODEL_VALUE:
      return genSetModelValue(oper, context)
    case IRNodeTypes.CREATE_TEXT_NODE:
      return genCreateTextNode(oper, context)
    case IRNodeTypes.INSERT_NODE:
      return genInsertNode(oper, context)
    case IRNodeTypes.PREPEND_NODE:
      return genPrependNode(oper, context)
    case IRNodeTypes.APPEND_NODE:
      return genAppendNode(oper, context)
    case IRNodeTypes.IF:
      return genIf(oper, context)
    case IRNodeTypes.WITH_DIRECTIVE:
      // generated, skip
      break
    default:
      return checkNever(oper)
  }

  return []
}

export function buildCodeFragment() {
  const frag: CodeFragment[] = []
  const push = frag.push.bind(frag)
  return [frag, push] as const
}

export function genBlockFunctionContent(
  ir: BlockFunctionIRNode | RootIRNode,
  ctx: CodegenContext,
): CodeFragment[] {
  const { newline, withIndent, vaporHelper } = ctx
  const [frag, push] = buildCodeFragment()

  push(newline(), `const n${ir.dynamic.id} = t${ir.templateIndex}()`)

  const children = genChildren(ir.dynamic.children)
  if (children) {
    push(
      newline(),
      `const ${children} = ${vaporHelper('children')}(n${ir.dynamic.id})`,
    )
  }

  const directiveOps = ir.operation.filter(
    (oper): oper is WithDirectiveIRNode =>
      oper.type === IRNodeTypes.WITH_DIRECTIVE,
  )
  for (const directives of groupDirective(directiveOps)) {
    push(...genWithDirective(directives, ctx))
  }

  for (const operation of ir.operation) {
    push(...genOperation(operation, ctx))
  }

  for (const { operations } of ir.effect) {
    push(newline(), `${vaporHelper('renderEffect')}(() => {`)
    withIndent(() => {
      operations.forEach(op => push(...genOperation(op, ctx)))
    })
    push(newline(), '})')
  }

  push(newline(), `return n${ir.dynamic.id}`)

  return frag
}

function groupDirective(ops: WithDirectiveIRNode[]): WithDirectiveIRNode[][] {
  const directiveMap: Record<number, WithDirectiveIRNode[]> = {}
  for (const oper of ops) {
    if (!directiveMap[oper.element]) directiveMap[oper.element] = []
    directiveMap[oper.element].push(oper)
  }
  return Object.values(directiveMap)
}
