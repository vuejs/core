import MagicString from 'magic-string'
import { BindingMetadata } from '@vue/compiler-core'
import { SFCDescriptor, SFCScriptBlock } from './parse'
import { parse as _parse, ParserOptions, ParserPlugin } from '@babel/parser'
import { babelParserDefaultPlugins, generateCodeFrame } from '@vue/shared'
import {
  Node,
  Declaration,
  ObjectPattern,
  ObjectExpression,
  ArrayPattern,
  Identifier,
  ExpressionStatement,
  ArrowFunctionExpression,
  ExportSpecifier,
  Function as FunctionNode,
  TSType,
  TSTypeLiteral,
  TSFunctionType,
  TSDeclareFunction,
  ObjectProperty,
  ArrayExpression,
  Statement,
  Expression,
  LabeledStatement
} from '@babel/types'
import { walk } from 'estree-walker'
import { RawSourceMap } from 'source-map'
import { genCssVarsCode, injectCssVarsCalls } from './genCssVars'

export interface SFCScriptCompileOptions {
  /**
   * https://babeljs.io/docs/en/babel-parser#plugins
   */
  babelParserPlugins?: ParserPlugin[]
  refSugar?: boolean
}

let hasWarned = false

/**
 * Compile `<script setup>`
 * It requires the whole SFC descriptor because we need to handle and merge
 * normal `<script>` + `<script setup>` if both are present.
 */
export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions = {}
): SFCScriptBlock {
  const { script, scriptSetup, styles, source, filename } = sfc

  if (__DEV__ && !__TEST__ && !hasWarned && scriptSetup) {
    hasWarned = true
    // @ts-ignore `console.info` cannot be null error
    console[console.info ? 'info' : 'log'](
      `\n[@vue/compiler-sfc] <script setup> is still an experimental proposal.\n` +
        `Follow https://github.com/vuejs/rfcs/pull/182 for its status.\n`
    )
  }

  const hasCssVars = styles.some(s => typeof s.attrs.vars === 'string')

  const scriptLang = script && script.lang
  const scriptSetupLang = scriptSetup && scriptSetup.lang
  const isTS = scriptLang === 'ts' || scriptSetupLang === 'ts'
  const plugins: ParserPlugin[] = [...babelParserDefaultPlugins, 'jsx']
  if (options.babelParserPlugins) plugins.push(...options.babelParserPlugins)
  if (isTS) plugins.push('typescript', 'decorators-legacy')

  if (!scriptSetup) {
    if (!script) {
      throw new Error(`[@vue/compiler-sfc] SFC contains no <script> tags.`)
    }
    if (scriptLang && scriptLang !== 'ts') {
      // do not process non js/ts script blocks
      return script
    }
    try {
      const scriptAst = _parse(script.content, {
        plugins,
        sourceType: 'module'
      }).program.body
      return {
        ...script,
        content: hasCssVars ? injectCssVarsCalls(sfc, plugins) : script.content,
        bindings: analyzeScriptBindings(scriptAst),
        scriptAst
      }
    } catch (e) {
      // silently fallback if parse fails since user may be using custom
      // babel syntax
      return script
    }
  }

  if (script && scriptLang !== scriptSetupLang) {
    throw new Error(
      `[@vue/compiler-sfc] <script> and <script setup> must have the same language type.`
    )
  }

  if (scriptSetupLang && scriptSetupLang !== 'ts') {
    // do not process non js/ts script blocks
    return scriptSetup
  }

  const defaultTempVar = `__default__`
  const bindingMetadata: BindingMetadata = {}
  const helperImports: Set<string> = new Set()
  const userImports: Record<string, string> = Object.create(null)
  const setupBindings: Record<string, boolean> = Object.create(null)
  const refBindings: Record<string, boolean> = Object.create(null)
  const refIdentifiers: Set<Identifier> = new Set()
  const enableRefSugar = options.refSugar !== false
  let defaultExport: Node | undefined
  let needDefaultExportRefCheck = false
  let hasAwait = false

  const s = new MagicString(source)
  const startOffset = scriptSetup.loc.start.offset
  const endOffset = scriptSetup.loc.end.offset
  const scriptStartOffset = script && script.loc.start.offset
  const scriptEndOffset = script && script.loc.end.offset

  function parse(
    input: string,
    options: ParserOptions,
    offset: number
  ): Statement[] {
    try {
      return _parse(input, options).program.body
    } catch (e) {
      e.message = `[@vue/compiler-sfc] ${e.message}\n\n${generateCodeFrame(
        source,
        e.pos + offset,
        e.pos + offset + 1
      )}`
      throw e
    }
  }

  function error(
    msg: string,
    node: Node,
    end: number = node.end! + startOffset
  ) {
    throw new Error(
      `[@vue/compiler-sfc] ${msg}\n\n` +
        generateCodeFrame(source, node.start! + startOffset, end)
    )
  }

  function processRefExpression(exp: Expression, statement: LabeledStatement) {
    if (exp.type === 'AssignmentExpression') {
      helperImports.add('ref')
      const { left, right } = exp
      if (left.type === 'Identifier') {
        if (left.name[0] === '$') {
          error(`ref variable identifiers cannot start with $.`, left)
        }
        refBindings[left.name] = setupBindings[left.name] = true
        refIdentifiers.add(left)
        s.prependRight(right.start! + startOffset, `ref(`)
        s.appendLeft(right.end! + startOffset, ')')
      } else if (left.type === 'ObjectPattern') {
        // remove wrapping parens
        for (let i = left.start!; i > 0; i--) {
          const char = source[i + startOffset]
          if (char === '(') {
            s.remove(i + startOffset, i + startOffset + 1)
            break
          }
        }
        for (let i = left.end!; i > 0; i++) {
          const char = source[i + startOffset]
          if (char === ')') {
            s.remove(i + startOffset, i + startOffset + 1)
            break
          }
        }
        processRefObjectPattern(left, statement)
      } else if (left.type === 'ArrayPattern') {
        processRefArrayPattern(left, statement)
      }
    } else if (exp.type === 'SequenceExpression') {
      // possible multiple declarations
      // ref: x = 1, y = 2
      exp.expressions.forEach(e => processRefExpression(e, statement))
    } else {
      error(`ref: statements can only contain assignment expressions.`, exp)
    }
  }

  function processRefObjectPattern(
    pattern: ObjectPattern,
    statement: LabeledStatement
  ) {
    for (const p of pattern.properties) {
      let nameId: Identifier | undefined
      if (p.type === 'ObjectProperty') {
        if (p.key.start! === p.value.start!) {
          // shorthand { foo } --> { foo: __foo }
          nameId = p.key as Identifier
          s.appendLeft(nameId.end! + startOffset, `: __${nameId.name}`)
          if (p.value.type === 'AssignmentPattern') {
            // { foo = 1 }
            refIdentifiers.add(p.value.left as Identifier)
          }
        } else {
          if (p.value.type === 'Identifier') {
            // { foo: bar } --> { foo: __bar }
            nameId = p.value
            s.prependRight(nameId.start! + startOffset, `__`)
          } else if (p.value.type === 'ObjectPattern') {
            processRefObjectPattern(p.value, statement)
          } else if (p.value.type === 'ArrayPattern') {
            processRefArrayPattern(p.value, statement)
          } else if (p.value.type === 'AssignmentPattern') {
            // { foo: bar = 1 } --> { foo: __bar = 1 }
            nameId = p.value.left as Identifier
            s.prependRight(nameId.start! + startOffset, `__`)
          }
        }
      } else {
        // rest element { ...foo } --> { ...__foo }
        nameId = p.argument as Identifier
        s.prependRight(nameId.start! + startOffset, `__`)
      }
      if (nameId) {
        // register binding
        refBindings[nameId.name] = setupBindings[nameId.name] = true
        refIdentifiers.add(nameId)
        // append binding declarations after the parent statement
        s.appendLeft(
          statement.end! + startOffset,
          `\nconst ${nameId.name} = ref(__${nameId.name});`
        )
      }
    }
  }

  function processRefArrayPattern(
    pattern: ArrayPattern,
    statement: LabeledStatement
  ) {
    for (const e of pattern.elements) {
      if (!e) continue
      let nameId: Identifier | undefined
      if (e.type === 'Identifier') {
        // [a] --> [__a]
        nameId = e
      } else if (e.type === 'AssignmentPattern') {
        // [a = 1] --> [__a = 1]
        nameId = e.left as Identifier
      } else if (e.type === 'RestElement') {
        // [...a] --> [...__a]
        nameId = e.argument as Identifier
      } else if (e.type === 'ObjectPattern') {
        processRefObjectPattern(e, statement)
      } else if (e.type === 'ArrayPattern') {
        processRefArrayPattern(e, statement)
      }
      if (nameId) {
        s.prependRight(nameId.start! + startOffset, `__`)
        // register binding
        refBindings[nameId.name] = setupBindings[nameId.name] = true
        refIdentifiers.add(nameId)
        // append binding declarations after the parent statement
        s.appendLeft(
          statement.end! + startOffset,
          `\nconst ${nameId.name} = ref(__${nameId.name});`
        )
      }
    }
  }

  // 1. process normal <script> first if it exists
  let scriptAst
  if (script) {
    // import dedupe between <script> and <script setup>
    scriptAst = parse(
      script.content,
      {
        plugins,
        sourceType: 'module'
      },
      scriptStartOffset!
    )

    for (const node of scriptAst) {
      if (node.type === 'ImportDeclaration') {
        // record imports for dedupe
        for (const {
          local: { name }
        } of node.specifiers) {
          userImports[name] = node.source.value
        }
      } else if (node.type === 'ExportDefaultDeclaration') {
        // export default
        defaultExport = node
        const start = node.start! + scriptStartOffset!
        s.overwrite(
          start,
          start + `export default`.length,
          `const ${defaultTempVar} =`
        )
      } else if (node.type === 'ExportNamedDeclaration' && node.specifiers) {
        const defaultSpecifier = node.specifiers.find(
          s => s.exported.type === 'Identifier' && s.exported.name === 'default'
        ) as ExportSpecifier
        if (defaultSpecifier) {
          defaultExport = node
          // 1. remove specifier
          if (node.specifiers.length > 1) {
            s.remove(
              defaultSpecifier.start! + scriptStartOffset!,
              defaultSpecifier.end! + scriptStartOffset!
            )
          } else {
            s.remove(
              node.start! + scriptStartOffset!,
              node.end! + scriptStartOffset!
            )
          }
          if (node.source) {
            // export { x as default } from './x'
            // rewrite to `import { x as __default__ } from './x'` and
            // add to top
            s.prepend(
              `import { ${
                defaultSpecifier.local.name
              } as ${defaultTempVar} } from '${node.source.value}'\n`
            )
          } else {
            // export { x as default }
            // rewrite to `const __default__ = x` and move to end
            s.append(
              `\nconst ${defaultTempVar} = ${defaultSpecifier.local.name}\n`
            )
          }
        }
      }
    }
  }

  // 2. check <script setup="xxx"> function signature
  const setupValue = scriptSetup.setup
  const hasExplicitSignature = typeof setupValue === 'string'

  let propsVar: string | undefined
  let emitVar: string | undefined
  let slotsVar: string | undefined
  let attrsVar: string | undefined

  let propsType = `{}`
  let emitType = `(e: string, ...args: any[]) => void`
  let slotsType = `__Slots__`
  let attrsType = `Record<string, any>`

  let propsASTNode
  let setupCtxASTNode

  // props/emits declared via types
  const typeDeclaredProps: Record<string, PropTypeData> = {}
  const typeDeclaredEmits: Set<string> = new Set()
  // record declared types for runtime props type generation
  const declaredTypes: Record<string, string[]> = {}

  // <script setup="xxx">
  if (hasExplicitSignature) {
    let signatureAST
    try {
      signatureAST = _parse(`(${setupValue})=>{}`, { plugins }).program.body[0]
    } catch (e) {
      throw new Error(
        `[@vue/compiler-sfc] Invalid <script setup> signature: ${setupValue}\n\n${generateCodeFrame(
          source,
          startOffset - 1,
          startOffset
        )}`
      )
    }

    if (isTS) {
      // <script setup="xxx" lang="ts">
      // parse the signature to extract the props/emit variables the user wants
      // we need them to find corresponding type declarations.
      const params = ((signatureAST as ExpressionStatement)
        .expression as ArrowFunctionExpression).params
      if (params[0] && params[0].type === 'Identifier') {
        propsASTNode = params[0]
        propsVar = propsASTNode.name
      }
      if (params[1] && params[1].type === 'ObjectPattern') {
        setupCtxASTNode = params[1]
        for (const p of params[1].properties) {
          if (
            p.type === 'ObjectProperty' &&
            p.key.type === 'Identifier' &&
            p.value.type === 'Identifier'
          ) {
            if (p.key.name === 'emit') {
              emitVar = p.value.name
            } else if (p.key.name === 'slots') {
              slotsVar = p.value.name
            } else if (p.key.name === 'attrs') {
              attrsVar = p.value.name
            }
          }
        }
      }
    }
  }

  // 3. parse <script setup> and  walk over top level statements
  const scriptSetupAst = parse(
    scriptSetup.content,
    {
      plugins: [
        ...plugins,
        // allow top level await but only inside <script setup>
        'topLevelAwait'
      ],
      sourceType: 'module'
    },
    startOffset
  )

  for (const node of scriptSetupAst) {
    const start = node.start! + startOffset
    let end = node.end! + startOffset
    // import or type declarations: move to top
    // locate comment
    if (node.trailingComments && node.trailingComments.length > 0) {
      const lastCommentNode =
        node.trailingComments[node.trailingComments.length - 1]
      end = lastCommentNode.end + startOffset
    }
    // locate the end of whitespace between this statement and the next
    while (end <= source.length) {
      if (!/\s/.test(source.charAt(end))) {
        break
      }
      end++
    }

    // process `ref: x` bindings (convert to refs)
    if (
      enableRefSugar &&
      node.type === 'LabeledStatement' &&
      node.label.name === 'ref' &&
      node.body.type === 'ExpressionStatement'
    ) {
      s.overwrite(
        node.label.start! + startOffset,
        node.body.start! + startOffset,
        'const '
      )
      processRefExpression(node.body.expression, node)
    }

    if (node.type === 'ImportDeclaration') {
      // import declarations are moved to top
      s.move(start, end, 0)
      // dedupe imports
      let prev
      let removed = 0
      for (const specifier of node.specifiers) {
        if (userImports[specifier.local.name]) {
          // already imported in <script setup>, dedupe
          removed++
          s.remove(
            prev ? prev.end! + startOffset : specifier.start! + startOffset,
            specifier.end! + startOffset
          )
        } else {
          userImports[specifier.local.name] = node.source.value
        }
        prev = specifier
      }
      if (removed === node.specifiers.length) {
        s.remove(node.start! + startOffset, node.end! + startOffset)
      }
    }

    if (node.type === 'ExportNamedDeclaration' && node.exportKind !== 'type') {
      // TODO warn
      error(`<script setup> cannot contain non-type named exports.`, node)
    }

    if (node.type === 'ExportAllDeclaration') {
      // TODO warn
    }

    if (node.type === 'ExportDefaultDeclaration') {
      if (defaultExport) {
        // <script> already has export default
        error(
          `Default export is already declared in normal <script>.`,
          node,
          node.start! + startOffset + `export default`.length
        )
      }
      // export default {} inside <script setup>
      // this should be kept in module scope - move it to the end
      s.move(start, end, source.length)
      s.overwrite(start, start + `export default`.length, `const __default__ =`)
      // save it for analysis when all imports and variable declarations have
      // been recorded
      defaultExport = node
      needDefaultExportRefCheck = true
    }

    if (
      (node.type === 'VariableDeclaration' ||
        node.type === 'FunctionDeclaration' ||
        node.type === 'ClassDeclaration') &&
      !node.declare
    ) {
      walkDeclaration(node, setupBindings)
    }

    // Type declarations
    if (node.type === 'VariableDeclaration' && node.declare) {
      s.remove(start, end)
      for (const { id } of node.declarations) {
        if (id.type === 'Identifier') {
          if (
            id.typeAnnotation &&
            id.typeAnnotation.type === 'TSTypeAnnotation'
          ) {
            const typeNode = id.typeAnnotation.typeAnnotation
            const typeString = source.slice(
              typeNode.start! + startOffset,
              typeNode.end! + startOffset
            )
            if (typeNode.type === 'TSTypeLiteral') {
              if (id.name === propsVar) {
                propsType = typeString
                extractRuntimeProps(typeNode, typeDeclaredProps, declaredTypes)
              } else if (id.name === slotsVar) {
                slotsType = typeString
              } else if (id.name === attrsVar) {
                attrsType = typeString
              }
            } else if (
              id.name === emitVar &&
              typeNode.type === 'TSFunctionType'
            ) {
              emitType = typeString
              extractRuntimeEmits(typeNode, typeDeclaredEmits)
            }
          }
        }
      }
    }

    if (
      node.type === 'TSDeclareFunction' &&
      node.id &&
      node.id.name === emitVar
    ) {
      const index = node.id.start! + startOffset
      s.overwrite(index, index + emitVar.length, '__emit__')
      emitType = `typeof __emit__`
      extractRuntimeEmits(node, typeDeclaredEmits)
    }

    // move all type declarations to outer scope
    if (
      node.type.startsWith('TS') ||
      (node.type === 'ExportNamedDeclaration' && node.exportKind === 'type')
    ) {
      recordType(node, declaredTypes)
      s.move(start, end, 0)
    }

    // walk statements & named exports / variable declarations for top level
    // await
    if (
      node.type === 'VariableDeclaration' ||
      node.type.endsWith('Statement')
    ) {
      ;(walk as any)(node, {
        enter(node: Node) {
          if (isFunction(node)) {
            this.skip()
          }
          if (node.type === 'AwaitExpression') {
            hasAwait = true
          }
        }
      })
    }
  }

  // 4. Do a full walk to rewrite identifiers referencing let exports with ref
  // value access
  if (enableRefSugar && Object.keys(refBindings).length) {
    for (const node of scriptSetupAst) {
      if (node.type !== 'ImportDeclaration') {
        walkIdentifiers(node, (id, parent) => {
          if (refBindings[id.name] && !refIdentifiers.has(id)) {
            if (isStaticProperty(parent) && parent.shorthand) {
              // let binding used in a property shorthand
              // { foo } -> { foo: foo.value }
              // skip for destructure patterns
              if (!(parent as any).inPattern) {
                s.appendLeft(id.end! + startOffset, `: ${id.name}.value`)
              }
            } else {
              s.appendLeft(id.end! + startOffset, '.value')
            }
          } else if (id.name[0] === '$' && refBindings[id.name.slice(1)]) {
            // $xxx raw ref access variables, remove the $ prefix
            s.remove(id.start! + startOffset, id.start! + startOffset + 1)
          }
        })
      }
    }
  }

  // 5. check default export to make sure it doesn't reference setup scope
  // variables
  if (needDefaultExportRefCheck) {
    walkIdentifiers(defaultExport!, id => {
      if (setupBindings[id.name]) {
        error(
          `\`export default\` in <script setup> cannot reference locally ` +
            `declared variables because it will be hoisted outside of the ` +
            `setup() function. If your component options requires initialization ` +
            `in the module scope, use a separate normal <script> to export ` +
            `the options instead.`,
          id
        )
      }
    })
  }

  // 6. remove non-script content
  if (script) {
    if (startOffset < scriptStartOffset!) {
      // <script setup> before <script>
      s.remove(endOffset, scriptStartOffset!)
      s.remove(scriptEndOffset!, source.length)
    } else {
      // <script> before <script setup>
      s.remove(0, scriptStartOffset!)
      s.remove(scriptEndOffset!, startOffset)
      s.remove(endOffset, source.length)
    }
  } else {
    // only <script setup>
    s.remove(0, startOffset)
    s.remove(endOffset, source.length)
  }

  // 7. finalize setup argument signature.
  let args = ``
  if (isTS) {
    if (slotsType === '__Slots__') {
      helperImports.add('Slots')
    }
    const ctxType = `{
  emit: ${emitType},
  slots: ${slotsType},
  attrs: ${attrsType}
}`
    if (hasExplicitSignature) {
      // inject types to user signature
      args = setupValue as string
      const ss = new MagicString(args)
      if (propsASTNode) {
        // compensate for () wraper offset
        ss.appendRight(propsASTNode.end! - 1, `: ${propsType}`)
      }
      if (setupCtxASTNode) {
        ss.appendRight(setupCtxASTNode.end! - 1!, `: ${ctxType}`)
      }
      args = ss.toString()
    }
  } else {
    args = hasExplicitSignature ? (setupValue as string) : ``
  }

  // 8. wrap setup code with function.
  // export the content of <script setup> as a named export, `setup`.
  // this allows `import { setup } from '*.vue'` for testing purposes.
  s.prependLeft(
    startOffset,
    `\nexport ${hasAwait ? `async ` : ``}function setup(${args}) {\n`
  )

  // generate return statement
  const exposedBindings = { ...userImports, ...setupBindings }
  let returned = `{ ${Object.keys(exposedBindings).join(', ')} }`

  // inject `useCssVars` calls
  if (hasCssVars) {
    helperImports.add(`useCssVars`)
    for (const style of styles) {
      const vars = style.attrs.vars
      if (typeof vars === 'string') {
        s.prependRight(
          endOffset,
          `\n${genCssVarsCode(vars, !!style.scoped, exposedBindings)}`
        )
      }
    }
  }

  s.appendRight(endOffset, `\nreturn ${returned}\n}\n\n`)

  // 9. finalize default export
  if (isTS) {
    // for TS, make sure the exported type is still valid type with
    // correct props information
    helperImports.add(`defineComponent`)
    // we have to use object spread for types to be merged properly
    // user's TS setting should compile it down to proper targets
    const def = defaultExport ? `\n  ...${defaultTempVar},` : ``
    const runtimeProps = genRuntimeProps(typeDeclaredProps)
    const runtimeEmits = genRuntimeEmits(typeDeclaredEmits)
    s.append(
      `export default __defineComponent__({${def}${runtimeProps}${runtimeEmits}\n  setup\n})`
    )
  } else {
    if (defaultExport) {
      s.append(
        `${defaultTempVar}.setup = setup\nexport default ${defaultTempVar}`
      )
    } else {
      s.append(`export default { setup }`)
    }
  }

  // 10. finalize Vue helper imports
  const helpers = [...helperImports].filter(i => userImports[i] !== 'vue')
  if (helpers.length) {
    s.prepend(`import { ${helpers.join(', ')} } from 'vue'\n`)
  }

  // 11. expose bindings for template compiler optimization
  if (scriptAst) {
    Object.assign(bindingMetadata, analyzeScriptBindings(scriptAst))
  }
  Object.keys(exposedBindings).forEach(key => {
    bindingMetadata[key] = 'setup'
  })
  Object.keys(typeDeclaredProps).forEach(key => {
    bindingMetadata[key] = 'props'
  })
  Object.assign(bindingMetadata, analyzeScriptBindings(scriptSetupAst))

  s.trim()
  return {
    ...scriptSetup,
    bindings: bindingMetadata,
    content: s.toString(),
    map: (s.generateMap({
      source: filename,
      hires: true,
      includeContent: true
    }) as unknown) as RawSourceMap,
    scriptAst,
    scriptSetupAst
  }
}

function walkDeclaration(node: Declaration, bindings: Record<string, boolean>) {
  if (node.type === 'VariableDeclaration') {
    // export const foo = ...
    for (const { id } of node.declarations) {
      if (id.type === 'Identifier') {
        bindings[id.name] = true
      } else if (id.type === 'ObjectPattern') {
        walkObjectPattern(id, bindings)
      } else if (id.type === 'ArrayPattern') {
        walkArrayPattern(id, bindings)
      }
    }
  } else if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'ClassDeclaration'
  ) {
    // export function foo() {} / export class Foo {}
    // export declarations must be named.
    bindings[node.id!.name] = true
  }
}

function walkObjectPattern(
  node: ObjectPattern,
  bindings: Record<string, boolean>
) {
  for (const p of node.properties) {
    if (p.type === 'ObjectProperty') {
      // key can only be Identifier in ObjectPattern
      if (p.key.type === 'Identifier') {
        if (p.key === p.value) {
          // const { x } = ...
          bindings[p.key.name] = true
        } else {
          walkPattern(p.value, bindings)
        }
      }
    } else {
      // ...rest
      // argument can only be identifer when destructuring
      bindings[(p.argument as Identifier).name] = true
    }
  }
}

function walkArrayPattern(
  node: ArrayPattern,
  bindings: Record<string, boolean>
) {
  for (const e of node.elements) {
    e && walkPattern(e, bindings)
  }
}

function walkPattern(node: Node, bindings: Record<string, boolean>) {
  if (node.type === 'Identifier') {
    bindings[node.name] = true
  } else if (node.type === 'RestElement') {
    // argument can only be identifer when destructuring
    bindings[(node.argument as Identifier).name] = true
  } else if (node.type === 'ObjectPattern') {
    walkObjectPattern(node, bindings)
  } else if (node.type === 'ArrayPattern') {
    walkArrayPattern(node, bindings)
  } else if (node.type === 'AssignmentPattern') {
    if (node.left.type === 'Identifier') {
      bindings[node.left.name] = true
    } else {
      walkPattern(node.left, bindings)
    }
  }
}

interface PropTypeData {
  key: string
  type: string[]
  required: boolean
}

function recordType(node: Node, declaredTypes: Record<string, string[]>) {
  if (node.type === 'TSInterfaceDeclaration') {
    declaredTypes[node.id.name] = [`Object`]
  } else if (node.type === 'TSTypeAliasDeclaration') {
    declaredTypes[node.id.name] = inferRuntimeType(
      node.typeAnnotation,
      declaredTypes
    )
  } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    recordType(node.declaration, declaredTypes)
  }
}

function extractRuntimeProps(
  node: TSTypeLiteral,
  props: Record<string, PropTypeData>,
  declaredTypes: Record<string, string[]>
) {
  for (const m of node.members) {
    if (m.type === 'TSPropertySignature' && m.key.type === 'Identifier') {
      props[m.key.name] = {
        key: m.key.name,
        required: !m.optional,
        type:
          __DEV__ && m.typeAnnotation
            ? inferRuntimeType(m.typeAnnotation.typeAnnotation, declaredTypes)
            : [`null`]
      }
    }
  }
}

function inferRuntimeType(
  node: TSType,
  declaredTypes: Record<string, string[]>
): string[] {
  switch (node.type) {
    case 'TSStringKeyword':
      return ['String']
    case 'TSNumberKeyword':
      return ['Number']
    case 'TSBooleanKeyword':
      return ['Boolean']
    case 'TSObjectKeyword':
      return ['Object']
    case 'TSTypeLiteral':
      // TODO (nice to have) generate runtime property validation
      return ['Object']
    case 'TSFunctionType':
      return ['Function']
    case 'TSArrayType':
    case 'TSTupleType':
      // TODO (nice to have) generate runtime element type/length checks
      return ['Array']

    case 'TSLiteralType':
      switch (node.literal.type) {
        case 'StringLiteral':
          return ['String']
        case 'BooleanLiteral':
          return ['Boolean']
        case 'NumericLiteral':
        case 'BigIntLiteral':
          return ['Number']
        default:
          return [`null`]
      }

    case 'TSTypeReference':
      if (node.typeName.type === 'Identifier') {
        if (declaredTypes[node.typeName.name]) {
          return declaredTypes[node.typeName.name]
        }
        switch (node.typeName.name) {
          case 'Array':
          case 'Function':
          case 'Object':
          case 'Set':
          case 'Map':
          case 'WeakSet':
          case 'WeakMap':
            return [node.typeName.name]
          case 'Record':
          case 'Partial':
          case 'Readonly':
          case 'Pick':
          case 'Omit':
          case 'Exclude':
          case 'Extract':
          case 'Required':
          case 'InstanceType':
            return ['Object']
        }
      }
      return [`null`]

    case 'TSUnionType':
      return [
        ...new Set(
          [].concat(node.types.map(t =>
            inferRuntimeType(t, declaredTypes)
          ) as any)
        )
      ]

    case 'TSIntersectionType':
      return ['Object']

    default:
      return [`null`] // no runtime check
  }
}

function genRuntimeProps(props: Record<string, PropTypeData>) {
  const keys = Object.keys(props)
  if (!keys.length) {
    return ``
  }

  if (!__DEV__) {
    // production: generate array version only
    return `\n  props: [\n    ${keys
      .map(k => JSON.stringify(k))
      .join(',\n    ')}\n  ] as unknown as undefined,`
  }

  return `\n  props: {\n    ${keys
    .map(key => {
      const { type, required } = props[key]
      return `${key}: { type: ${toRuntimeTypeString(
        type
      )}, required: ${required} }`
    })
    .join(',\n    ')}\n  } as unknown as undefined,`
}

function toRuntimeTypeString(types: string[]) {
  return types.some(t => t === 'null')
    ? `null`
    : types.length > 1
      ? `[${types.join(', ')}]`
      : types[0]
}

function extractRuntimeEmits(
  node: TSFunctionType | TSDeclareFunction,
  emits: Set<string>
) {
  const eventName =
    node.type === 'TSDeclareFunction' ? node.params[0] : node.parameters[0]
  if (
    eventName.type === 'Identifier' &&
    eventName.typeAnnotation &&
    eventName.typeAnnotation.type === 'TSTypeAnnotation'
  ) {
    const typeNode = eventName.typeAnnotation.typeAnnotation
    if (typeNode.type === 'TSLiteralType') {
      emits.add(String(typeNode.literal.value))
    } else if (typeNode.type === 'TSUnionType') {
      for (const t of typeNode.types) {
        if (t.type === 'TSLiteralType') {
          emits.add(String(t.literal.value))
        }
      }
    }
  }
}

function genRuntimeEmits(emits: Set<string>) {
  return emits.size
    ? `\n  emits: [${Array.from(emits)
        .map(p => JSON.stringify(p))
        .join(', ')}] as unknown as undefined,`
    : ``
}

/**
 * Walk an AST and find identifiers that are variable references.
 * This is largely the same logic with `transformExpressions` in compiler-core
 * but with some subtle differences as this needs to handle a wider range of
 * possible syntax.
 */
function walkIdentifiers(
  root: Node,
  onIdentifier: (node: Identifier, parent: Node) => void
) {
  const knownIds: Record<string, number> = Object.create(null)
  ;(walk as any)(root, {
    enter(node: Node & { scopeIds?: Set<string> }, parent: Node) {
      if (node.type === 'Identifier') {
        if (!knownIds[node.name] && isRefIdentifier(node, parent)) {
          onIdentifier(node, parent)
        }
      } else if (isFunction(node)) {
        // walk function expressions and add its arguments to known identifiers
        // so that we don't prefix them
        node.params.forEach(p =>
          (walk as any)(p, {
            enter(child: Node, parent: Node) {
              if (
                child.type === 'Identifier' &&
                // do not record as scope variable if is a destructured key
                !isStaticPropertyKey(child, parent) &&
                // do not record if this is a default value
                // assignment of a destructured variable
                !(
                  parent &&
                  parent.type === 'AssignmentPattern' &&
                  parent.right === child
                )
              ) {
                const { name } = child
                if (node.scopeIds && node.scopeIds.has(name)) {
                  return
                }
                if (name in knownIds) {
                  knownIds[name]++
                } else {
                  knownIds[name] = 1
                }
                ;(node.scopeIds || (node.scopeIds = new Set())).add(name)
              }
            }
          })
        )
      } else if (
        node.type === 'ObjectProperty' &&
        parent.type === 'ObjectPattern'
      ) {
        // mark property in destructure pattern
        ;(node as any).inPattern = true
      }
    },
    leave(node: Node & { scopeIds?: Set<string> }) {
      if (node.scopeIds) {
        node.scopeIds.forEach((id: string) => {
          knownIds[id]--
          if (knownIds[id] === 0) {
            delete knownIds[id]
          }
        })
      }
    }
  })
}

function isRefIdentifier(id: Identifier, parent: Node) {
  // declaration id
  if (
    (parent.type === 'VariableDeclarator' ||
      parent.type === 'ClassDeclaration') &&
    parent.id === id
  ) {
    return false
  }

  if (isFunction(parent)) {
    // function decalration/expression id
    if ((parent as any).id === id) {
      return false
    }
    // params list
    if (parent.params.includes(id)) {
      return false
    }
  }

  // property key
  // this also covers object destructure pattern
  if (isStaticPropertyKey(id, parent)) {
    return false
  }

  // array destructure pattern
  if (parent.type === 'ArrayPattern') {
    return false
  }

  // member expression property
  if (
    (parent.type === 'MemberExpression' ||
      parent.type === 'OptionalMemberExpression') &&
    parent.property === id &&
    !parent.computed
  ) {
    return false
  }

  // is a special keyword but parsed as identifier
  if (id.name === 'arguments') {
    return false
  }

  return true
}

const isStaticProperty = (node: Node): node is ObjectProperty =>
  node &&
  (node.type === 'ObjectProperty' || node.type === 'ObjectMethod') &&
  !node.computed

const isStaticPropertyKey = (node: Node, parent: Node) =>
  isStaticProperty(parent) && parent.key === node

function isFunction(node: Node): node is FunctionNode {
  return /Function(?:Expression|Declaration)$|Method$/.test(node.type)
}

function getObjectExpressionKeys(node: ObjectExpression): string[] {
  const keys = []
  for (const prop of node.properties) {
    if (
      (prop.type === 'ObjectProperty' || prop.type === 'ObjectMethod') &&
      !prop.computed
    ) {
      if (prop.key.type === 'Identifier') {
        keys.push(prop.key.name)
      } else if (prop.key.type === 'StringLiteral') {
        keys.push(prop.key.value)
      }
    }
  }
  return keys
}

function getArrayExpressionKeys(node: ArrayExpression): string[] {
  const keys = []
  for (const element of node.elements) {
    if (element && element.type === 'StringLiteral') {
      keys.push(element.value)
    }
  }
  return keys
}

function getObjectOrArrayExpressionKeys(property: ObjectProperty): string[] {
  if (property.value.type === 'ArrayExpression') {
    return getArrayExpressionKeys(property.value)
  }
  if (property.value.type === 'ObjectExpression') {
    return getObjectExpressionKeys(property.value)
  }
  return []
}

/**
 * Analyze bindings in normal `<script>`
 * Note that `compileScriptSetup` already analyzes bindings as part of its
 * compilation process so this should only be used on single `<script>` SFCs.
 */
function analyzeScriptBindings(ast: Statement[]): BindingMetadata {
  const bindings: BindingMetadata = {}

  for (const node of ast) {
    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'ObjectExpression'
    ) {
      for (const property of node.declaration.properties) {
        if (
          property.type === 'ObjectProperty' &&
          !property.computed &&
          property.key.type === 'Identifier'
        ) {
          // props
          if (property.key.name === 'props') {
            // props: ['foo']
            // props: { foo: ... }
            for (const key of getObjectOrArrayExpressionKeys(property)) {
              bindings[key] = 'props'
            }
          }

          // inject
          else if (property.key.name === 'inject') {
            // inject: ['foo']
            // inject: { foo: {} }
            for (const key of getObjectOrArrayExpressionKeys(property)) {
              bindings[key] = 'options'
            }
          }

          // computed & methods
          else if (
            property.value.type === 'ObjectExpression' &&
            (property.key.name === 'computed' ||
              property.key.name === 'methods')
          ) {
            // methods: { foo() {} }
            // computed: { foo() {} }
            for (const key of getObjectExpressionKeys(property.value)) {
              bindings[key] = 'options'
            }
          }
        }

        // setup & data
        else if (
          property.type === 'ObjectMethod' &&
          property.key.type === 'Identifier' &&
          (property.key.name === 'setup' || property.key.name === 'data')
        ) {
          for (const bodyItem of property.body.body) {
            // setup() {
            //   return {
            //     foo: null
            //   }
            // }
            if (
              bodyItem.type === 'ReturnStatement' &&
              bodyItem.argument &&
              bodyItem.argument.type === 'ObjectExpression'
            ) {
              for (const key of getObjectExpressionKeys(bodyItem.argument)) {
                bindings[key] = property.key.name
              }
            }
          }
        }
      }
    }
  }

  return bindings
}
