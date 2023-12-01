import {
  type CodegenOptions,
  type CodegenResult,
  type Position,
  NewlineType,
  advancePositionWithMutation,
  locStub,
} from '@vue/compiler-dom'
import {
  type DynamicChildren,
  type RootIRNode,
  IRNodeTypes,
  OperationNode,
  VaporHelper,
  IRNode,
} from './ir'
import { SourceMapGenerator } from 'source-map-js'

// remove when stable
// @ts-expect-error
function checkNever(x: never): never {}

export interface CodegenContext
  extends Omit<Required<CodegenOptions>, 'bindingMetadata' | 'inline'> {
  source: string
  code: string
  line: number
  column: number
  offset: number
  indentLevel: number
  map?: SourceMapGenerator

  push(code: string, newlineIndex?: NewlineType, node?: IRNode): void
  indent(): void
  deindent(withoutNewLine?: boolean): void
  newline(): void

  helpers: Set<string>
  vaporHelpers: Set<string>
  helper(name: string): string
  vaporHelper(name: string): string
}

function createCodegenContext(
  ir: RootIRNode,
  {
    mode = 'function',
    prefixIdentifiers = mode === 'module',
    sourceMap = false,
    filename = `template.vue.html`,
    scopeId = null,
    optimizeImports = false,
    runtimeGlobalName = `Vue`,
    runtimeModuleName = `vue`,
    ssrRuntimeModuleName = 'vue/server-renderer',
    ssr = false,
    isTS = false,
    inSSR = false,
  }: CodegenOptions,
) {
  const { helpers, vaporHelpers } = ir
  const context: CodegenContext = {
    mode,
    prefixIdentifiers,
    sourceMap,
    filename,
    scopeId,
    optimizeImports,
    runtimeGlobalName,
    runtimeModuleName,
    ssrRuntimeModuleName,
    ssr,
    isTS,
    inSSR,

    source: ir.source,
    code: ``,
    column: 1,
    line: 1,
    offset: 0,
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
    push(code, newlineIndex: NewlineType = NewlineType.None, node) {
      context.code += code
      if (!__BROWSER__ && context.map) {
        if (node) {
          // TODO
          let name
          // if (node.type === NodeTypes.SIMPLE_EXPRESSION && !node.isStatic) {
          //   const content = node.content.replace(/^_ctx\./, '')
          //   if (content !== node.content && isSimpleIdentifier(content)) {
          //     name = content
          //   }
          // }
          addMapping(node.loc.start, name)
        }
        if (newlineIndex === NewlineType.Unknown) {
          // multiple newlines, full iteration
          advancePositionWithMutation(context, code)
        } else {
          // fast paths
          context.offset += code.length
          if (newlineIndex === NewlineType.None) {
            // no newlines; fast path to avoid newline detection
            if (__TEST__ && code.includes('\n')) {
              throw new Error(
                `CodegenContext.push() called newlineIndex: none, but contains` +
                  `newlines: ${code.replace(/\n/g, '\\n')}`,
              )
            }
            context.column += code.length
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
            context.line++
            context.column = code.length - newlineIndex
          }
        }
        if (node && node.loc !== locStub) {
          addMapping(node.loc.end)
        }
      }
    },
    indent() {
      newline(++context.indentLevel)
    },
    deindent(withoutNewLine = false) {
      if (withoutNewLine) {
        --context.indentLevel
      } else {
        newline(--context.indentLevel)
      }
    },
    newline() {
      newline(context.indentLevel)
    },
  }

  function newline(n: number) {
    context.push(`\n${`  `.repeat(n)}`, NewlineType.Start)
  }

  function addMapping(loc: Position, name: string | null = null) {
    // we use the private property to directly add the mapping
    // because the addMapping() implementation in source-map-js has a bunch of
    // unnecessary arg and validation checks that are pure overhead in our case.
    const { _names, _mappings } = context.map!
    if (name !== null && !_names.has(name)) _names.add(name)
    _mappings.add({
      originalLine: loc.line,
      originalColumn: loc.column - 1, // source-map column is 0 based
      generatedLine: context.line,
      generatedColumn: context.column - 1,
      source: filename,
      // @ts-ignore it is possible to be null
      name,
    })
  }

  if (!__BROWSER__ && sourceMap) {
    // lazy require source-map implementation, only in non-browser builds
    context.map = new SourceMapGenerator()
    context.map.setSourceContent(filename, context.source)
    context.map._sources.add(filename)
  }

  return context
}

// IR -> JS codegen
export function generate(
  ir: RootIRNode,
  options: CodegenOptions = {},
): CodegenResult {
  const ctx = createCodegenContext(ir, options)
  const { vaporHelper, helpers, vaporHelpers } = ctx

  const functionName = 'render'
  const isSetupInlined = !!options.inline
  if (isSetupInlined) {
    ctx.push(`(() => {\n`, NewlineType.End)
  } else {
    ctx.push(`export function ${functionName}(_ctx) {\n`, NewlineType.End)
  }

  ir.template.forEach((template, i) => {
    if (template.type === IRNodeTypes.TEMPLATE_FACTORY) {
      // TODO source map?
      ctx.push(
        `const t${i} = ${vaporHelper('template')}(${JSON.stringify(
          template.template,
        )})\n`,
        NewlineType.End,
      )
    } else {
      // fragment
      ctx.push(`const t0 = ${vaporHelper('fragment')}()\n`, NewlineType.End)
    }
  })

  {
    ctx.push(`const n${ir.dynamic.id} = t0()\n`, NewlineType.End, ir)
    const children = genChildren(ir.dynamic.children)
    if (children) {
      ctx.push(
        `const ${children} = ${vaporHelper('children')}(n${ir.dynamic.id})\n`,
        NewlineType.End,
      )
    }

    for (const operation of ir.operation) {
      genOperation(operation, ctx).forEach((args) => ctx.push(...args))
    }
    for (const [_expr, operations] of Object.entries(ir.effect)) {
      ctx.push(`${vaporHelper('effect')}(() => {\n`, NewlineType.End)
      for (const operation of operations) {
        genOperation(operation, ctx).forEach((args) => ctx.push(...args))
      }
      ctx.push('})\n', NewlineType.End)
    }
    // TODO multiple-template
    // TODO return statement in IR
    ctx.push(`return n${ir.dynamic.id}\n`, NewlineType.End)
  }

  if (isSetupInlined) {
    ctx.push('})()')
  } else {
    ctx.push('}')
  }

  ctx.newline()

  if (vaporHelpers.size)
    // TODO: extract
    ctx.push(
      `import { ${[...vaporHelpers]
        .map((h) => `${h} as _${h}`)
        .join(', ')} } from 'vue/vapor'\n`,
      NewlineType.End,
    )
  if (helpers.size)
    ctx.push(
      `import { ${[...helpers]
        .map((h) => `${h} as _${h}`)
        .join(', ')} } from 'vue'\n`,
      NewlineType.End,
    )

  return {
    code: ctx.code,
    ast: ir as any,
    preamble: '',
    map: ctx.map ? ctx.map.toJSON() : undefined,
  }
}

function genOperation(
  oper: OperationNode,
  { vaporHelper }: CodegenContext,
): Parameters<CodegenContext['push']>[] {
  // TODO: cache old value
  switch (oper.type) {
    case IRNodeTypes.SET_PROP: {
      return [
        [
          `${vaporHelper('setAttr')}(n${oper.element}, ${JSON.stringify(
            oper.name,
          )}, undefined, ${oper.value})\n`,
          NewlineType.End,
        ],
      ]
    }

    case IRNodeTypes.SET_TEXT: {
      return [
        [
          `${vaporHelper('setText')}(n${oper.element}, undefined, ${
            oper.value
          })\n`,
          NewlineType.End,
        ],
      ]
    }

    case IRNodeTypes.SET_EVENT: {
      let value = oper.value
      if (oper.modifiers.length) {
        value = `${vaporHelper('withModifiers')}(${value}, ${genArrayExpression(
          oper.modifiers,
        )})`
      }
      return [
        [
          `${vaporHelper('on')}(n${oper.element}, ${JSON.stringify(
            oper.name,
          )}, ${value})\n`,
          NewlineType.End,
        ],
      ]
    }

    case IRNodeTypes.SET_HTML: {
      return [
        [
          `${vaporHelper('setHtml')}(n${oper.element}, undefined, ${
            oper.value
          })\n`,
          NewlineType.End,
        ],
      ]
    }

    case IRNodeTypes.CREATE_TEXT_NODE: {
      return [
        [
          `const n${oper.id} = ${vaporHelper('createTextNode')}(${
            oper.value
          })\n`,
          NewlineType.End,
        ],
      ]
    }

    case IRNodeTypes.INSERT_NODE: {
      const elements = ([] as number[]).concat(oper.element)
      let element = elements.map((el) => `n${el}`).join(', ')
      if (elements.length > 1) element = `[${element}]`
      return [
        [
          `${vaporHelper('insert')}(${element}, n${
            oper.parent
          }${`, n${oper.anchor}`})\n`,
          NewlineType.End,
        ],
      ]
    }
    case IRNodeTypes.PREPEND_NODE: {
      return [
        [
          `${vaporHelper('prepend')}(n${oper.parent}, ${oper.elements
            .map((el) => `n${el}`)
            .join(', ')})\n`,
          NewlineType.End,
        ],
      ]
    }
    case IRNodeTypes.APPEND_NODE: {
      return [
        [
          `${vaporHelper('append')}(n${oper.parent}, ${oper.elements
            .map((el) => `n${el}`)
            .join(', ')})\n`,
          NewlineType.End,
        ],
      ]
    }
    default:
      return checkNever(oper)
  }
}

function genChildren(children: DynamicChildren) {
  let code = ''
  // TODO
  let offset = 0
  for (const [index, child] of Object.entries(children)) {
    const childrenLength = Object.keys(child.children).length
    if (child.ghost && child.placeholder === null && childrenLength === 0) {
      offset--
      continue
    }

    code += ` ${Number(index) + offset}: [`

    const id = child.ghost ? child.placeholder : child.id
    if (id !== null) code += `n${id}`

    const childrenString = childrenLength && genChildren(child.children)
    if (childrenString) code += `, ${childrenString}`

    code += '],'
  }

  if (!code) return ''
  return `{${code}}`
}

// TODO: other types (not only string)
function genArrayExpression(elements: string[]) {
  return `[${elements.map((it) => `"${it}"`).join(', ')}]`
}
