import {
  type CodegenOptions,
  type CodegenResult,
  type Position,
  type SourceLocation,
  NewlineType,
  advancePositionWithMutation,
  locStub,
  NodeTypes,
  BindingTypes,
  isSimpleIdentifier,
} from '@vue/compiler-dom'
import {
  type IRDynamicChildren,
  type RootIRNode,
  IRNodeTypes,
  OperationNode,
  VaporHelper,
  IRExpression,
} from './ir'
import { SourceMapGenerator } from 'source-map-js'
import { isString } from '@vue/shared'

// remove when stable
// @ts-expect-error
function checkNever(x: never): never {}

export interface CodegenContext extends Required<CodegenOptions> {
  source: string
  code: string
  line: number
  column: number
  offset: number
  indentLevel: number
  map?: SourceMapGenerator

  push(
    code: string,
    newlineIndex?: number,
    loc?: SourceLocation,
    name?: string,
  ): void
  pushWithNewline(
    code: string,
    newlineIndex?: number,
    loc?: SourceLocation,
    name?: string,
  ): void
  indent(): void
  deindent(): void
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
    inline = false,
    bindingMetadata = {},
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
    bindingMetadata,
    inline,

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
    push(code, newlineIndex = NewlineType.None, loc, name) {
      context.code += code
      if (!__BROWSER__ && context.map) {
        if (loc) addMapping(loc.start, name)

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
        if (loc && loc !== locStub) {
          addMapping(loc.end)
        }
      }
    },
    pushWithNewline(code, newlineIndex, node) {
      context.newline()
      context.push(code, newlineIndex, node)
    },
    indent() {
      ++context.indentLevel
    },
    deindent() {
      --context.indentLevel
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
  const { push, pushWithNewline, indent, deindent, newline } = ctx
  const { vaporHelper, helpers, vaporHelpers } = ctx

  const functionName = 'render'
  const isSetupInlined = !!options.inline
  if (isSetupInlined) {
    push(`(() => {`)
  } else {
    // placeholder for preamble
    newline()
    pushWithNewline(`export function ${functionName}(_ctx) {`)
  }
  indent()

  ir.template.forEach((template, i) => {
    if (template.type === IRNodeTypes.TEMPLATE_FACTORY) {
      // TODO source map?
      pushWithNewline(
        `const t${i} = ${vaporHelper('template')}(${JSON.stringify(
          template.template,
        )})`,
      )
    } else {
      // fragment
      pushWithNewline(
        `const t0 = ${vaporHelper('fragment')}()\n`,
        NewlineType.End,
      )
    }
  })

  {
    pushWithNewline(`const n${ir.dynamic.id} = t0()`)

    const children = genChildren(ir.dynamic.children)
    if (children) {
      pushWithNewline(
        `const ${children} = ${vaporHelper('children')}(n${ir.dynamic.id})`,
      )
    }

    for (const operation of ir.operation) {
      genOperation(operation, ctx)
    }
    for (const { operations } of ir.effect) {
      pushWithNewline(`${vaporHelper('effect')}(() => {`)
      indent()
      for (const operation of operations) {
        genOperation(operation, ctx)
      }
      deindent()
      pushWithNewline('})')
    }
    // TODO multiple-template
    // TODO return statement in IR
    pushWithNewline(`return n${ir.dynamic.id}`)
  }

  deindent()
  newline()
  if (isSetupInlined) {
    push('})()')
  } else {
    push('}')
  }

  let preamble = ''
  if (vaporHelpers.size)
    // TODO: extract import codegen
    preamble = `import { ${[...vaporHelpers]
      .map((h) => `${h} as _${h}`)
      .join(', ')} } from 'vue/vapor';`
  if (helpers.size)
    preamble = `import { ${[...helpers]
      .map((h) => `${h} as _${h}`)
      .join(', ')} } from 'vue';`

  if (!isSetupInlined) {
    ctx.code = preamble + ctx.code
  }

  return {
    code: ctx.code,
    ast: ir as any,
    preamble,
    map: ctx.map ? ctx.map.toJSON() : undefined,
  }
}

function genOperation(oper: OperationNode, context: CodegenContext) {
  const { vaporHelper, push, pushWithNewline } = context
  // TODO: cache old value
  switch (oper.type) {
    case IRNodeTypes.SET_PROP: {
      pushWithNewline(`${vaporHelper('setAttr')}(n${oper.element}, `)
      genExpression(oper.name, context)
      push(`, undefined, `)
      genExpression(oper.value, context)
      push(')')
      return
    }

    case IRNodeTypes.SET_TEXT: {
      pushWithNewline(`${vaporHelper('setText')}(n${oper.element}, undefined, `)
      genExpression(oper.value, context)
      push(')')
      return
    }

    case IRNodeTypes.SET_EVENT: {
      pushWithNewline(`${vaporHelper('on')}(n${oper.element}, `)
      genExpression(oper.name, context)
      push(', ')

      const hasModifiers = oper.modifiers.length
      hasModifiers && push(`${vaporHelper('withModifiers')}(`)
      genExpression(oper.value, context)
      hasModifiers && push(`, ${genArrayExpression(oper.modifiers)})`)

      push(')')
      return
    }

    case IRNodeTypes.SET_HTML: {
      pushWithNewline(`${vaporHelper('setHtml')}(n${oper.element}, undefined, `)
      genExpression(oper.value, context)
      push(')')
      return
    }

    case IRNodeTypes.CREATE_TEXT_NODE: {
      pushWithNewline(`const n${oper.id} = ${vaporHelper('createTextNode')}(`)
      genExpression(oper.value, context)
      push(')')
      return
    }

    case IRNodeTypes.INSERT_NODE: {
      const elements = ([] as number[]).concat(oper.element)
      let element = elements.map((el) => `n${el}`).join(', ')
      if (elements.length > 1) element = `[${element}]`
      pushWithNewline(
        `${vaporHelper('insert')}(${element}, n${
          oper.parent
        }${`, n${oper.anchor}`})`,
      )
      return
    }
    case IRNodeTypes.PREPEND_NODE: {
      pushWithNewline(
        `${vaporHelper('prepend')}(n${oper.parent}, ${oper.elements
          .map((el) => `n${el}`)
          .join(', ')})`,
      )
      return
    }
    case IRNodeTypes.APPEND_NODE: {
      pushWithNewline(
        `${vaporHelper('append')}(n${oper.parent}, ${oper.elements
          .map((el) => `n${el}`)
          .join(', ')})`,
      )
      return
    }
    default:
      return checkNever(oper)
  }
}

function genChildren(children: IRDynamicChildren) {
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
  return `[${elements.map((it) => JSON.stringify(it)).join(', ')}]`
}

function genExpression(
  exp: IRExpression,
  {
    inline,
    prefixIdentifiers,
    bindingMetadata,
    vaporHelper,
    push,
  }: CodegenContext,
) {
  if (isString(exp)) return push(exp)

  // TODO NodeTypes.COMPOUND_EXPRESSION
  if (exp.type === NodeTypes.COMPOUND_EXPRESSION) return

  let { content } = exp
  let name: string | undefined

  if (exp.isStatic) {
    content = JSON.stringify(content)
  } else {
    switch (bindingMetadata[content]) {
      case BindingTypes.SETUP_REF:
        content += '.value'
        break
      case BindingTypes.SETUP_MAYBE_REF:
        content = `${vaporHelper('unref')}(${content})`
        break
    }
    if (prefixIdentifiers && !inline) {
      if (isSimpleIdentifier(content)) name = content
      content = `_ctx.${content}`
    }
  }

  push(content, NewlineType.None, exp.loc, name)
}
