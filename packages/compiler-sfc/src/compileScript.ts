import MagicString from 'magic-string'
import {
  BindingMetadata,
  BindingTypes,
  createRoot,
  NodeTypes,
  transform,
  parserOptions,
  UNREF,
  SimpleExpressionNode,
  isFunctionType,
  walkIdentifiers,
  getImportedName,
  unwrapTSNode,
  isCallOf
} from '@vue/compiler-dom'
import { DEFAULT_FILENAME, SFCDescriptor, SFCScriptBlock } from './parse'
import {
  parse as _parse,
  parseExpression,
  ParserOptions,
  ParserPlugin
} from '@babel/parser'
import { camelize, capitalize, generateCodeFrame, makeMap } from '@vue/shared'
import {
  Node,
  Declaration,
  ObjectPattern,
  ObjectExpression,
  ArrayPattern,
  Identifier,
  ExportSpecifier,
  TSType,
  TSTypeLiteral,
  TSFunctionType,
  ObjectProperty,
  ArrayExpression,
  Statement,
  CallExpression,
  RestElement,
  TSInterfaceBody,
  TSTypeElement,
  AwaitExpression,
  Program,
  ObjectMethod,
  LVal,
  Expression,
  VariableDeclaration,
  TSEnumDeclaration
} from '@babel/types'
import { walk } from 'estree-walker'
import { RawSourceMap } from 'source-map'
import {
  CSS_VARS_HELPER,
  genCssVarsCode,
  genNormalScriptCssVarsCode
} from './cssVars'
import { compileTemplate, SFCTemplateCompileOptions } from './compileTemplate'
import { warnOnce } from './warn'
import { rewriteDefaultAST } from './rewriteDefault'
import { createCache } from './cache'
import { shouldTransform, transformAST } from '@vue/reactivity-transform'
import { transformDestructuredProps } from './compileScriptPropsDestructure'

// Special compiler macros
const DEFINE_PROPS = 'defineProps'
const DEFINE_EMITS = 'defineEmits'
const DEFINE_EXPOSE = 'defineExpose'
const WITH_DEFAULTS = 'withDefaults'
const DEFINE_OPTIONS = 'defineOptions'

const isBuiltInDir = makeMap(
  `once,memo,if,for,else,else-if,slot,text,html,on,bind,model,show,cloak,is`
)

export interface SFCScriptCompileOptions {
  /**
   * Scope ID for prefixing injected CSS variables.
   * This must be consistent with the `id` passed to `compileStyle`.
   */
  id: string
  /**
   * Production mode. Used to determine whether to generate hashed CSS variables
   */
  isProd?: boolean
  /**
   * Enable/disable source map. Defaults to true.
   */
  sourceMap?: boolean
  /**
   * https://babeljs.io/docs/en/babel-parser#plugins
   */
  babelParserPlugins?: ParserPlugin[]
  /**
   * (Experimental) Enable syntax transform for using refs without `.value` and
   * using destructured props with reactivity
   * @deprecated the Reactivity Transform proposal has been dropped. This
   * feature will be removed from Vue core in 3.4. If you intend to continue
   * using it, disable this and switch to the [Vue Macros implementation](https://vue-macros.sxzz.moe/features/reactivity-transform.html).
   */
  reactivityTransform?: boolean
  /**
   * Compile the template and inline the resulting render function
   * directly inside setup().
   * - Only affects `<script setup>`
   * - This should only be used in production because it prevents the template
   * from being hot-reloaded separately from component state.
   */
  inlineTemplate?: boolean
  /**
   * Generate the final component as a variable instead of default export.
   * This is useful in e.g. @vitejs/plugin-vue where the script needs to be
   * placed inside the main module.
   */
  genDefaultAs?: string
  /**
   * Options for template compilation when inlining. Note these are options that
   * would normally be passed to `compiler-sfc`'s own `compileTemplate()`, not
   * options passed to `compiler-dom`.
   */
  templateOptions?: Partial<SFCTemplateCompileOptions>

  /**
   * Hoist <script setup> static constants.
   * - Only enables when one `<script setup>` exists.
   * @default true
   */
  hoistStatic?: boolean
}

export interface ImportBinding {
  isType: boolean
  imported: string
  local: string
  source: string
  isFromSetup: boolean
  isUsedInTemplate: boolean
}

export type PropsDestructureBindings = Record<
  string, // public prop key
  {
    local: string // local identifier, may be different
    default?: Expression
  }
>

type FromNormalScript<T> = T & { __fromNormalScript?: boolean | null }
type PropsDeclType = FromNormalScript<TSTypeLiteral | TSInterfaceBody>
type EmitsDeclType = FromNormalScript<
  TSFunctionType | TSTypeLiteral | TSInterfaceBody
>

/**
 * Compile `<script setup>`
 * It requires the whole SFC descriptor because we need to handle and merge
 * normal `<script>` + `<script setup>` if both are present.
 */
export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions
): SFCScriptBlock {
  let { script, scriptSetup, source, filename } = sfc
  // feature flags
  // TODO remove support for deprecated options when out of experimental
  const enableReactivityTransform = !!options.reactivityTransform
  const isProd = !!options.isProd
  const genSourceMap = options.sourceMap !== false
  const hoistStatic = options.hoistStatic !== false && !script
  let refBindings: string[] | undefined

  if (!options.id) {
    warnOnce(
      `compileScript now requires passing the \`id\` option.\n` +
        `Upgrade your vite or vue-loader version for compatibility with ` +
        `the latest experimental proposals.`
    )
  }

  const scopeId = options.id ? options.id.replace(/^data-v-/, '') : ''
  const cssVars = sfc.cssVars
  const scriptLang = script && script.lang
  const scriptSetupLang = scriptSetup && scriptSetup.lang
  const genDefaultAs = options.genDefaultAs
    ? `const ${options.genDefaultAs} =`
    : `export default`
  const normalScriptDefaultVar = `__default__`
  const isJS =
    scriptLang === 'js' ||
    scriptLang === 'jsx' ||
    scriptSetupLang === 'js' ||
    scriptSetupLang === 'jsx'
  const isTS =
    scriptLang === 'ts' ||
    scriptLang === 'tsx' ||
    scriptSetupLang === 'ts' ||
    scriptSetupLang === 'tsx'

  // resolve parser plugins
  const plugins: ParserPlugin[] = []
  if (!isTS || scriptLang === 'tsx' || scriptSetupLang === 'tsx') {
    plugins.push('jsx')
  } else {
    // If don't match the case of adding jsx, should remove the jsx from the babelParserPlugins
    if (options.babelParserPlugins)
      options.babelParserPlugins = options.babelParserPlugins.filter(
        n => n !== 'jsx'
      )
  }
  if (options.babelParserPlugins) plugins.push(...options.babelParserPlugins)
  if (isTS) {
    plugins.push('typescript')
    if (!plugins.includes('decorators')) {
      plugins.push('decorators-legacy')
    }
  }

  if (!scriptSetup) {
    if (!script) {
      throw new Error(`[@vue/compiler-sfc] SFC contains no <script> tags.`)
    }
    if (scriptLang && !isJS && !isTS) {
      // do not process non js/ts script blocks
      return script
    }
    // normal <script> only
    try {
      let content = script.content
      let map = script.map
      const scriptAst = _parse(content, {
        plugins,
        sourceType: 'module'
      }).program
      const bindings = analyzeScriptBindings(scriptAst.body)
      if (enableReactivityTransform && shouldTransform(content)) {
        const s = new MagicString(source)
        const startOffset = script.loc.start.offset
        const endOffset = script.loc.end.offset
        const { importedHelpers } = transformAST(scriptAst, s, startOffset)
        if (importedHelpers.length) {
          s.prepend(
            `import { ${importedHelpers
              .map(h => `${h} as _${h}`)
              .join(', ')} } from 'vue'\n`
          )
        }
        s.remove(0, startOffset)
        s.remove(endOffset, source.length)
        content = s.toString()
        if (genSourceMap) {
          map = s.generateMap({
            source: filename,
            hires: true,
            includeContent: true
          }) as unknown as RawSourceMap
        }
      }
      if (cssVars.length || options.genDefaultAs) {
        const defaultVar = options.genDefaultAs || normalScriptDefaultVar
        const s = new MagicString(content)
        rewriteDefaultAST(scriptAst.body, s, defaultVar)
        content = s.toString()
        if (cssVars.length) {
          content += genNormalScriptCssVarsCode(
            cssVars,
            bindings,
            scopeId,
            isProd,
            defaultVar
          )
        }
        if (!options.genDefaultAs) {
          content += `\nexport default ${defaultVar}`
        }
      }
      return {
        ...script,
        content,
        map,
        bindings,
        scriptAst: scriptAst.body
      }
    } catch (e: any) {
      // silently fallback if parse fails since user may be using custom
      // babel syntax
      return script
    }
  }

  if (script && scriptLang !== scriptSetupLang) {
    throw new Error(
      `[@vue/compiler-sfc] <script> and <script setup> must have the same ` +
        `language type.`
    )
  }

  if (scriptSetupLang && !isJS && !isTS) {
    // do not process non js/ts script blocks
    return scriptSetup
  }

  // metadata that needs to be returned
  const bindingMetadata: BindingMetadata = {}
  const helperImports: Set<string> = new Set()
  const userImports: Record<string, ImportBinding> = Object.create(null)
  const scriptBindings: Record<string, BindingTypes> = Object.create(null)
  const setupBindings: Record<string, BindingTypes> = Object.create(null)

  let defaultExport: Node | undefined
  let hasDefinePropsCall = false
  let hasDefineEmitCall = false
  let hasDefineExposeCall = false
  let hasDefaultExportName = false
  let hasDefaultExportRender = false
  let hasDefineOptionsCall = false
  let propsRuntimeDecl: Node | undefined
  let propsRuntimeDefaults: ObjectExpression | undefined
  let propsDestructureDecl: Node | undefined
  let propsDestructureRestId: string | undefined
  let propsTypeDecl: PropsDeclType | undefined
  let propsTypeDeclRaw: Node | undefined
  let propsIdentifier: string | undefined
  let emitsRuntimeDecl: Node | undefined
  let emitsTypeDecl: EmitsDeclType | undefined
  let emitsTypeDeclRaw: Node | undefined
  let emitIdentifier: string | undefined
  let optionsRuntimeDecl: Node | undefined
  let hasAwait = false
  let hasInlinedSsrRenderFn = false
  // props/emits declared via types
  const typeDeclaredProps: Record<string, PropTypeData> = {}
  const typeDeclaredEmits: Set<string> = new Set()
  // record declared types for runtime props type generation
  const declaredTypes: Record<string, string[]> = {}
  // props destructure data
  const propsDestructuredBindings: PropsDestructureBindings =
    Object.create(null)

  // magic-string state
  const s = new MagicString(source)
  const startOffset = scriptSetup.loc.start.offset
  const endOffset = scriptSetup.loc.end.offset
  const scriptStartOffset = script && script.loc.start.offset
  const scriptEndOffset = script && script.loc.end.offset

  function helper(key: string): string {
    helperImports.add(key)
    return `_${key}`
  }

  function parse(
    input: string,
    options: ParserOptions,
    offset: number
  ): Program {
    try {
      return _parse(input, options).program
    } catch (e: any) {
      e.message = `[@vue/compiler-sfc] ${e.message}\n\n${
        sfc.filename
      }\n${generateCodeFrame(source, e.pos + offset, e.pos + offset + 1)}`
      throw e
    }
  }

  function error(
    msg: string,
    node: Node,
    end: number = node.end! + startOffset
  ): never {
    throw new Error(
      `[@vue/compiler-sfc] ${msg}\n\n${sfc.filename}\n${generateCodeFrame(
        source,
        node.start! + startOffset,
        end
      )}`
    )
  }

  function hoistNode(node: Statement) {
    const start = node.start! + startOffset
    let end = node.end! + startOffset
    // locate comment
    if (node.trailingComments && node.trailingComments.length > 0) {
      const lastCommentNode =
        node.trailingComments[node.trailingComments.length - 1]
      end = lastCommentNode.end! + startOffset
    }
    // locate the end of whitespace between this statement and the next
    while (end <= source.length) {
      if (!/\s/.test(source.charAt(end))) {
        break
      }
      end++
    }
    s.move(start, end, 0)
  }

  function registerUserImport(
    source: string,
    local: string,
    imported: string,
    isType: boolean,
    isFromSetup: boolean,
    needTemplateUsageCheck: boolean
  ) {
    // template usage check is only needed in non-inline mode, so we can skip
    // the work if inlineTemplate is true.
    let isUsedInTemplate = needTemplateUsageCheck
    if (
      needTemplateUsageCheck &&
      isTS &&
      sfc.template &&
      !sfc.template.src &&
      !sfc.template.lang
    ) {
      isUsedInTemplate = isImportUsed(local, sfc)
    }

    userImports[local] = {
      isType,
      imported,
      local,
      source,
      isFromSetup,
      isUsedInTemplate
    }
  }

  function processDefineProps(node: Node, declId?: LVal): boolean {
    if (!isCallOf(node, DEFINE_PROPS)) {
      return false
    }

    if (hasDefinePropsCall) {
      error(`duplicate ${DEFINE_PROPS}() call`, node)
    }
    hasDefinePropsCall = true

    propsRuntimeDecl = node.arguments[0]

    // call has type parameters - infer runtime types from it
    if (node.typeParameters) {
      if (propsRuntimeDecl) {
        error(
          `${DEFINE_PROPS}() cannot accept both type and non-type arguments ` +
            `at the same time. Use one or the other.`,
          node
        )
      }

      propsTypeDeclRaw = node.typeParameters.params[0]
      propsTypeDecl = resolveQualifiedType(
        propsTypeDeclRaw,
        node => node.type === 'TSTypeLiteral'
      ) as PropsDeclType | undefined

      if (!propsTypeDecl) {
        error(
          `type argument passed to ${DEFINE_PROPS}() must be a literal type, ` +
            `or a reference to an interface or literal type.`,
          propsTypeDeclRaw
        )
      }
    }

    if (declId) {
      // handle props destructure
      if (declId.type === 'ObjectPattern') {
        propsDestructureDecl = declId
        for (const prop of declId.properties) {
          if (prop.type === 'ObjectProperty') {
            const propKey = resolveObjectKey(prop.key, prop.computed)

            if (!propKey) {
              error(
                `${DEFINE_PROPS}() destructure cannot use computed key.`,
                prop.key
              )
            }

            if (prop.value.type === 'AssignmentPattern') {
              // default value { foo = 123 }
              const { left, right } = prop.value
              if (left.type !== 'Identifier') {
                error(
                  `${DEFINE_PROPS}() destructure does not support nested patterns.`,
                  left
                )
              }
              // store default value
              propsDestructuredBindings[propKey] = {
                local: left.name,
                default: right
              }
            } else if (prop.value.type === 'Identifier') {
              // simple destructure
              propsDestructuredBindings[propKey] = {
                local: prop.value.name
              }
            } else {
              error(
                `${DEFINE_PROPS}() destructure does not support nested patterns.`,
                prop.value
              )
            }
          } else {
            // rest spread
            propsDestructureRestId = (prop.argument as Identifier).name
          }
        }
      } else {
        propsIdentifier = scriptSetup!.content.slice(declId.start!, declId.end!)
      }
    }

    return true
  }

  function processWithDefaults(
    node: Node,
    declId?: LVal,
    declKind?: VariableDeclaration['kind']
  ): boolean {
    if (!isCallOf(node, WITH_DEFAULTS)) {
      return false
    }
    warnOnce(
      `withDefaults() has been deprecated. ` +
        `Props destructure is now reactive by default - ` +
        `use destructure with default values instead.`
    )
    if (processDefineProps(node.arguments[0], declId)) {
      if (propsRuntimeDecl) {
        error(
          `${WITH_DEFAULTS} can only be used with type-based ` +
            `${DEFINE_PROPS} declaration.`,
          node
        )
      }
      if (propsDestructureDecl) {
        error(
          `${WITH_DEFAULTS}() is unnecessary when using destructure with ${DEFINE_PROPS}().\n` +
            `Prefer using destructure default values, e.g. const { foo = 1 } = defineProps(...).`,
          node.callee
        )
      }
      propsRuntimeDefaults = node.arguments[1] as ObjectExpression
      if (
        !propsRuntimeDefaults ||
        propsRuntimeDefaults.type !== 'ObjectExpression'
      ) {
        error(
          `The 2nd argument of ${WITH_DEFAULTS} must be an object literal.`,
          propsRuntimeDefaults || node
        )
      }
    } else {
      error(
        `${WITH_DEFAULTS}' first argument must be a ${DEFINE_PROPS} call.`,
        node.arguments[0] || node
      )
    }
    return true
  }

  function processDefineEmits(node: Node, declId?: LVal): boolean {
    if (!isCallOf(node, DEFINE_EMITS)) {
      return false
    }
    if (hasDefineEmitCall) {
      error(`duplicate ${DEFINE_EMITS}() call`, node)
    }
    hasDefineEmitCall = true
    emitsRuntimeDecl = node.arguments[0]
    if (node.typeParameters) {
      if (emitsRuntimeDecl) {
        error(
          `${DEFINE_EMITS}() cannot accept both type and non-type arguments ` +
            `at the same time. Use one or the other.`,
          node
        )
      }

      emitsTypeDeclRaw = node.typeParameters.params[0]
      emitsTypeDecl = resolveQualifiedType(
        emitsTypeDeclRaw,
        node => node.type === 'TSFunctionType' || node.type === 'TSTypeLiteral'
      ) as EmitsDeclType | undefined

      if (!emitsTypeDecl) {
        error(
          `type argument passed to ${DEFINE_EMITS}() must be a function type, ` +
            `a literal type with call signatures, or a reference to the above types.`,
          emitsTypeDeclRaw
        )
      }
    }

    if (declId) {
      emitIdentifier =
        declId.type === 'Identifier'
          ? declId.name
          : scriptSetup!.content.slice(declId.start!, declId.end!)
    }

    return true
  }

  function getAstBody(): Statement[] {
    return scriptAst
      ? [...scriptSetupAst.body, ...scriptAst.body]
      : scriptSetupAst.body
  }

  function resolveExtendsType(
    node: Node,
    qualifier: (node: Node) => boolean,
    cache: Array<Node> = []
  ): Array<Node> {
    if (node.type === 'TSInterfaceDeclaration' && node.extends) {
      node.extends.forEach(extend => {
        if (
          extend.type === 'TSExpressionWithTypeArguments' &&
          extend.expression.type === 'Identifier'
        ) {
          const body = getAstBody()
          for (const node of body) {
            const qualified = isQualifiedType(
              node,
              qualifier,
              extend.expression.name
            )
            if (qualified) {
              cache.push(qualified)
              resolveExtendsType(node, qualifier, cache)
              return cache
            }
          }
        }
      })
    }
    return cache
  }

  function isQualifiedType(
    node: Node,
    qualifier: (node: Node) => boolean,
    refName: String
  ): Node | undefined {
    if (node.type === 'TSInterfaceDeclaration' && node.id.name === refName) {
      return node.body
    } else if (
      node.type === 'TSTypeAliasDeclaration' &&
      node.id.name === refName &&
      qualifier(node.typeAnnotation)
    ) {
      return node.typeAnnotation
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      return isQualifiedType(node.declaration, qualifier, refName)
    }
  }

  // filter all extends types to keep the override declaration
  function filterExtendsType(extendsTypes: Node[], bodies: TSTypeElement[]) {
    extendsTypes.forEach(extend => {
      const body = (extend as TSInterfaceBody).body
      body.forEach(newBody => {
        if (
          newBody.type === 'TSPropertySignature' &&
          newBody.key.type === 'Identifier'
        ) {
          const name = newBody.key.name
          const hasOverride = bodies.some(
            seenBody =>
              seenBody.type === 'TSPropertySignature' &&
              seenBody.key.type === 'Identifier' &&
              seenBody.key.name === name
          )
          if (!hasOverride) bodies.push(newBody)
        }
      })
    })
  }

  function processDefineOptions(node: Node): boolean {
    if (!isCallOf(node, DEFINE_OPTIONS)) {
      return false
    }
    if (hasDefineOptionsCall) {
      error(`duplicate ${DEFINE_OPTIONS}() call`, node)
    }
    if (node.typeParameters) {
      error(`${DEFINE_OPTIONS}() cannot accept type arguments`, node)
    }

    hasDefineOptionsCall = true
    optionsRuntimeDecl = node.arguments[0]

    let propsOption = undefined
    let emitsOption = undefined
    let exposeOption = undefined
    if (optionsRuntimeDecl.type === 'ObjectExpression') {
      for (const prop of optionsRuntimeDecl.properties) {
        if (
          (prop.type === 'ObjectProperty' || prop.type === 'ObjectMethod') &&
          prop.key.type === 'Identifier'
        ) {
          if (prop.key.name === 'props') propsOption = prop
          if (prop.key.name === 'emits') emitsOption = prop
          if (prop.key.name === 'expose') exposeOption = prop
        }
      }
    }

    if (propsOption) {
      error(
        `${DEFINE_OPTIONS}() cannot be used to declare props. Use ${DEFINE_PROPS}() instead.`,
        propsOption
      )
    }
    if (emitsOption) {
      error(
        `${DEFINE_OPTIONS}() cannot be used to declare emits. Use ${DEFINE_EMITS}() instead.`,
        emitsOption
      )
    }
    if (exposeOption) {
      error(
        `${DEFINE_OPTIONS}() cannot be used to declare expose. Use ${DEFINE_EXPOSE}() instead.`,
        exposeOption
      )
    }

    return true
  }

  function resolveQualifiedType(
    node: Node,
    qualifier: (node: Node) => boolean
  ): Node | undefined {
    if (qualifier(node)) {
      return node
    }
    if (
      node.type === 'TSTypeReference' &&
      node.typeName.type === 'Identifier'
    ) {
      const refName = node.typeName.name
      const body = getAstBody()
      for (let i = 0; i < body.length; i++) {
        const node = body[i]
        let qualified = isQualifiedType(
          node,
          qualifier,
          refName
        ) as TSInterfaceBody
        if (qualified) {
          const extendsTypes = resolveExtendsType(node, qualifier)
          if (extendsTypes.length) {
            const bodies: TSTypeElement[] = [...qualified.body]
            filterExtendsType(extendsTypes, bodies)
            qualified.body = bodies
          }
          ;(qualified as FromNormalScript<Node>).__fromNormalScript =
            scriptAst && i >= scriptSetupAst.body.length
          return qualified
        }
      }
    }
  }

  function processDefineExpose(node: Node): boolean {
    if (isCallOf(node, DEFINE_EXPOSE)) {
      if (hasDefineExposeCall) {
        error(`duplicate ${DEFINE_EXPOSE}() call`, node)
      }
      hasDefineExposeCall = true
      return true
    }
    return false
  }

  function checkInvalidScopeReference(node: Node | undefined, method: string) {
    if (!node) return
    walkIdentifiers(node, id => {
      const binding = setupBindings[id.name]
      if (binding && (binding !== BindingTypes.LITERAL_CONST || !hoistStatic)) {
        error(
          `\`${method}()\` in <script setup> cannot reference locally ` +
            `declared variables because it will be hoisted outside of the ` +
            `setup() function. If your component options require initialization ` +
            `in the module scope, use a separate normal <script> to export ` +
            `the options instead.`,
          id
        )
      }
    })
  }

  /**
   * await foo()
   * -->
   * ;(
   *   ([__temp,__restore] = withAsyncContext(() => foo())),
   *   await __temp,
   *   __restore()
   * )
   *
   * const a = await foo()
   * -->
   * const a = (
   *   ([__temp, __restore] = withAsyncContext(() => foo())),
   *   __temp = await __temp,
   *   __restore(),
   *   __temp
   * )
   */
  function processAwait(
    node: AwaitExpression,
    needSemi: boolean,
    isStatement: boolean
  ) {
    const argumentStart =
      node.argument.extra && node.argument.extra.parenthesized
        ? (node.argument.extra.parenStart as number)
        : node.argument.start!

    const argumentStr = source.slice(
      argumentStart + startOffset,
      node.argument.end! + startOffset
    )

    const containsNestedAwait = /\bawait\b/.test(argumentStr)

    s.overwrite(
      node.start! + startOffset,
      argumentStart + startOffset,
      `${needSemi ? `;` : ``}(\n  ([__temp,__restore] = ${helper(
        `withAsyncContext`
      )}(${containsNestedAwait ? `async ` : ``}() => `
    )
    s.appendLeft(
      node.end! + startOffset,
      `)),\n  ${isStatement ? `` : `__temp = `}await __temp,\n  __restore()${
        isStatement ? `` : `,\n  __temp`
      }\n)`
    )
  }

  /**
   * check defaults. If the default object is an object literal with only
   * static properties, we can directly generate more optimized default
   * declarations. Otherwise we will have to fallback to runtime merging.
   */
  function hasStaticWithDefaults() {
    return (
      propsRuntimeDefaults &&
      propsRuntimeDefaults.type === 'ObjectExpression' &&
      propsRuntimeDefaults.properties.every(
        node =>
          (node.type === 'ObjectProperty' &&
            (!node.computed || node.key.type.endsWith('Literal'))) ||
          node.type === 'ObjectMethod'
      )
    )
  }

  function genRuntimeProps(props: Record<string, PropTypeData>) {
    const keys = Object.keys(props)
    if (!keys.length) {
      return ``
    }
    const hasStaticDefaults = hasStaticWithDefaults()
    const scriptSetupSource = scriptSetup!.content
    let propsDecls = `{
    ${keys
      .map(key => {
        let defaultString: string | undefined
        const destructured = genDestructuredDefaultValue(key, props[key].type)
        if (destructured) {
          defaultString = `default: ${destructured.valueString}${
            destructured.needSkipFactory ? `, skipFactory: true` : ``
          }`
        } else if (hasStaticDefaults) {
          const prop = propsRuntimeDefaults!.properties.find(node => {
            if (node.type === 'SpreadElement') return false
            return resolveObjectKey(node.key, node.computed) === key
          }) as ObjectProperty | ObjectMethod
          if (prop) {
            if (prop.type === 'ObjectProperty') {
              // prop has corresponding static default value
              defaultString = `default: ${scriptSetupSource.slice(
                prop.value.start!,
                prop.value.end!
              )}`
            } else {
              defaultString = `${prop.async ? 'async ' : ''}${
                prop.kind !== 'method' ? `${prop.kind} ` : ''
              }default() ${scriptSetupSource.slice(
                prop.body.start!,
                prop.body.end!
              )}`
            }
          }
        }

        const { type, required, skipCheck } = props[key]
        if (!isProd) {
          return `${key}: { type: ${toRuntimeTypeString(
            type
          )}, required: ${required}${skipCheck ? ', skipCheck: true' : ''}${
            defaultString ? `, ${defaultString}` : ``
          } }`
        } else if (
          type.some(
            el =>
              el === 'Boolean' ||
              ((!hasStaticDefaults || defaultString) && el === 'Function')
          )
        ) {
          // #4783 for boolean, should keep the type
          // #7111 for function, if default value exists or it's not static, should keep it
          // in production
          return `${key}: { type: ${toRuntimeTypeString(type)}${
            defaultString ? `, ${defaultString}` : ``
          } }`
        } else {
          // production: checks are useless
          return `${key}: ${defaultString ? `{ ${defaultString} }` : 'null'}`
        }
      })
      .join(',\n    ')}\n  }`

    if (propsRuntimeDefaults && !hasStaticDefaults) {
      propsDecls = `${helper('mergeDefaults')}(${propsDecls}, ${source.slice(
        propsRuntimeDefaults.start! + startOffset,
        propsRuntimeDefaults.end! + startOffset
      )})`
    }

    return `\n  props: ${propsDecls},`
  }

  function genDestructuredDefaultValue(
    key: string,
    inferredType?: string[]
  ):
    | {
        valueString: string
        needSkipFactory: boolean
      }
    | undefined {
    const destructured = propsDestructuredBindings[key]
    const defaultVal = destructured && destructured.default
    if (defaultVal) {
      const value = scriptSetup!.content.slice(
        defaultVal.start!,
        defaultVal.end!
      )

      const unwrapped = unwrapTSNode(defaultVal)

      if (
        inferredType &&
        inferredType.length &&
        !inferredType.includes(UNKNOWN_TYPE)
      ) {
        const valueType = inferValueType(unwrapped)
        if (valueType && !inferredType.includes(valueType)) {
          error(
            `Default value of prop "${key}" does not match declared type.`,
            unwrapped
          )
        }
      }

      // If the default value is a function or is an identifier referencing
      // external value, skip factory wrap. This is needed when using
      // destructure w/ runtime declaration since we cannot safely infer
      // whether tje expected runtime prop type is `Function`.
      const needSkipFactory =
        !inferredType &&
        (isFunctionType(unwrapped) || unwrapped.type === 'Identifier')

      const needFactoryWrap =
        !needSkipFactory &&
        !isLiteralNode(unwrapped) &&
        !inferredType?.includes('Function')

      return {
        valueString: needFactoryWrap ? `() => (${value})` : value,
        needSkipFactory
      }
    }
  }

  function genSetupPropsType(node: PropsDeclType) {
    const scriptSource = node.__fromNormalScript
      ? script!.content
      : scriptSetup!.content
    if (hasStaticWithDefaults()) {
      // if withDefaults() is used, we need to remove the optional flags
      // on props that have default values
      let res = `{ `
      const members = node.type === 'TSTypeLiteral' ? node.members : node.body
      for (const m of members) {
        if (
          (m.type === 'TSPropertySignature' ||
            m.type === 'TSMethodSignature') &&
          m.typeAnnotation &&
          m.key.type === 'Identifier'
        ) {
          if (
            propsRuntimeDefaults!.properties.some(p => {
              if (p.type === 'SpreadElement') return false
              return (
                resolveObjectKey(p.key, p.computed) ===
                (m.key as Identifier).name
              )
            })
          ) {
            res +=
              m.key.name +
              (m.type === 'TSMethodSignature' ? '()' : '') +
              scriptSource.slice(
                m.typeAnnotation.start!,
                m.typeAnnotation.end!
              ) +
              ', '
          } else {
            res += scriptSource.slice(m.start!, m.typeAnnotation.end!) + `, `
          }
        }
      }
      return (res.length ? res.slice(0, -2) : res) + ` }`
    } else {
      return scriptSource.slice(node.start!, node.end!)
    }
  }

  // 0. parse both <script> and <script setup> blocks
  const scriptAst =
    script &&
    parse(
      script.content,
      {
        plugins,
        sourceType: 'module'
      },
      scriptStartOffset!
    )

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

  // 1.1 walk import delcarations of <script>
  if (scriptAst) {
    for (const node of scriptAst.body) {
      if (node.type === 'ImportDeclaration') {
        // record imports for dedupe
        for (const specifier of node.specifiers) {
          const imported = getImportedName(specifier)
          registerUserImport(
            node.source.value,
            specifier.local.name,
            imported,
            node.importKind === 'type' ||
              (specifier.type === 'ImportSpecifier' &&
                specifier.importKind === 'type'),
            false,
            !options.inlineTemplate
          )
        }
      }
    }
  }

  // 1.2 walk import declarations of <script setup>
  for (const node of scriptSetupAst.body) {
    if (node.type === 'ImportDeclaration') {
      // import declarations are moved to top
      hoistNode(node)

      // dedupe imports
      let removed = 0
      const removeSpecifier = (i: number) => {
        const removeLeft = i > removed
        removed++
        const current = node.specifiers[i]
        const next = node.specifiers[i + 1]
        s.remove(
          removeLeft
            ? node.specifiers[i - 1].end! + startOffset
            : current.start! + startOffset,
          next && !removeLeft
            ? next.start! + startOffset
            : current.end! + startOffset
        )
      }

      for (let i = 0; i < node.specifiers.length; i++) {
        const specifier = node.specifiers[i]
        const local = specifier.local.name
        const imported = getImportedName(specifier)
        const source = node.source.value
        const existing = userImports[local]
        if (
          source === 'vue' &&
          (imported === DEFINE_PROPS ||
            imported === DEFINE_EMITS ||
            imported === DEFINE_EXPOSE)
        ) {
          warnOnce(
            `\`${imported}\` is a compiler macro and no longer needs to be imported.`
          )
          removeSpecifier(i)
        } else if (existing) {
          if (existing.source === source && existing.imported === imported) {
            // already imported in <script setup>, dedupe
            removeSpecifier(i)
          } else {
            error(`different imports aliased to same local name.`, specifier)
          }
        } else {
          registerUserImport(
            source,
            local,
            imported,
            node.importKind === 'type' ||
              (specifier.type === 'ImportSpecifier' &&
                specifier.importKind === 'type'),
            true,
            !options.inlineTemplate
          )
        }
      }
      if (node.specifiers.length && removed === node.specifiers.length) {
        s.remove(node.start! + startOffset, node.end! + startOffset)
      }
    }
  }

  // 1.3 resolve possible user import alias of `ref` and `reactive`
  const vueImportAliases: Record<string, string> = {}
  for (const key in userImports) {
    const { source, imported, local } = userImports[key]
    if (source === 'vue') vueImportAliases[imported] = local
  }

  // 2.1 process normal <script> body
  if (script && scriptAst) {
    for (const node of scriptAst.body) {
      if (node.type === 'ExportDefaultDeclaration') {
        // export default
        defaultExport = node

        // check if user has manually specified `name` or 'render` option in
        // export default
        // if has name, skip name inference
        // if has render and no template, generate return object instead of
        // empty render function (#4980)
        let optionProperties
        if (defaultExport.declaration.type === 'ObjectExpression') {
          optionProperties = defaultExport.declaration.properties
        } else if (
          defaultExport.declaration.type === 'CallExpression' &&
          defaultExport.declaration.arguments[0] &&
          defaultExport.declaration.arguments[0].type === 'ObjectExpression'
        ) {
          optionProperties = defaultExport.declaration.arguments[0].properties
        }
        if (optionProperties) {
          for (const s of optionProperties) {
            if (
              s.type === 'ObjectProperty' &&
              s.key.type === 'Identifier' &&
              s.key.name === 'name'
            ) {
              hasDefaultExportName = true
            }
            if (
              (s.type === 'ObjectMethod' || s.type === 'ObjectProperty') &&
              s.key.type === 'Identifier' &&
              s.key.name === 'render'
            ) {
              // TODO warn when we provide a better way to do it?
              hasDefaultExportRender = true
            }
          }
        }

        // export default { ... } --> const __default__ = { ... }
        const start = node.start! + scriptStartOffset!
        const end = node.declaration.start! + scriptStartOffset!
        s.overwrite(start, end, `const ${normalScriptDefaultVar} = `)
      } else if (node.type === 'ExportNamedDeclaration') {
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
              `import { ${defaultSpecifier.local.name} as ${normalScriptDefaultVar} } from '${node.source.value}'\n`
            )
          } else {
            // export { x as default }
            // rewrite to `const __default__ = x` and move to end
            s.appendLeft(
              scriptEndOffset!,
              `\nconst ${normalScriptDefaultVar} = ${defaultSpecifier.local.name}\n`
            )
          }
        }
        if (node.declaration) {
          walkDeclaration(node.declaration, scriptBindings, vueImportAliases)
        }
      } else if (
        (node.type === 'VariableDeclaration' ||
          node.type === 'FunctionDeclaration' ||
          node.type === 'ClassDeclaration' ||
          node.type === 'TSEnumDeclaration') &&
        !node.declare
      ) {
        walkDeclaration(node, scriptBindings, vueImportAliases)
      }
    }

    // apply reactivity transform
    // TODO remove in 3.4
    if (enableReactivityTransform && shouldTransform(script.content)) {
      const { rootRefs, importedHelpers } = transformAST(
        scriptAst,
        s,
        scriptStartOffset!
      )
      refBindings = rootRefs
      for (const h of importedHelpers) {
        helperImports.add(h)
      }
    }

    // <script> after <script setup>
    // we need to move the block up so that `const __default__` is
    // declared before being used in the actual component definition
    if (scriptStartOffset! > startOffset) {
      // if content doesn't end with newline, add one
      if (!/\n$/.test(script.content.trim())) {
        s.appendLeft(scriptEndOffset!, `\n`)
      }
      s.move(scriptStartOffset!, scriptEndOffset!, 0)
    }
  }

  // 2.2 process <script setup> body
  for (const node of scriptSetupAst.body) {
    // (Dropped) `ref: x` bindings
    // TODO remove when out of experimental
    if (
      node.type === 'LabeledStatement' &&
      node.label.name === 'ref' &&
      node.body.type === 'ExpressionStatement'
    ) {
      error(
        `ref sugar using the label syntax was an experimental proposal and ` +
          `has been dropped based on community feedback. Please check out ` +
          `the new proposal at https://github.com/vuejs/rfcs/discussions/369`,
        node
      )
    }

    if (node.type === 'ExpressionStatement') {
      const expr = unwrapTSNode(node.expression)
      // process `defineProps` and `defineEmit(s)` calls
      if (
        processDefineProps(expr) ||
        processDefineEmits(expr) ||
        processDefineOptions(expr) ||
        processWithDefaults(expr)
      ) {
        s.remove(node.start! + startOffset, node.end! + startOffset)
      } else if (processDefineExpose(expr)) {
        // defineExpose({}) -> expose({})
        const callee = (expr as CallExpression).callee
        s.overwrite(
          callee.start! + startOffset,
          callee.end! + startOffset,
          '__expose'
        )
      }
    }

    if (node.type === 'VariableDeclaration' && !node.declare) {
      const total = node.declarations.length
      let left = total
      let lastNonRemoved: number | undefined

      for (let i = 0; i < total; i++) {
        const decl = node.declarations[i]
        const init = decl.init && unwrapTSNode(decl.init)
        if (init) {
          if (processDefineOptions(init)) {
            error(
              `${DEFINE_OPTIONS}() has no returning value, it cannot be assigned.`,
              node
            )
          }

          // defineProps / defineEmits
          const isDefineProps =
            processDefineProps(init, decl.id) ||
            processWithDefaults(init, decl.id, node.kind)
          const isDefineEmits = processDefineEmits(init, decl.id)
          if (isDefineProps || isDefineEmits) {
            if (left === 1) {
              s.remove(node.start! + startOffset, node.end! + startOffset)
            } else {
              let start = decl.start! + startOffset
              let end = decl.end! + startOffset
              if (i === total - 1) {
                // last one, locate the end of the last one that is not removed
                // if we arrive at this branch, there must have been a
                // non-removed decl before us, so lastNonRemoved is non-null.
                start = node.declarations[lastNonRemoved!].end! + startOffset
              } else {
                // not the last one, locate the start of the next
                end = node.declarations[i + 1].start! + startOffset
              }
              s.remove(start, end)
              left--
            }
          } else {
            lastNonRemoved = i
          }
        }
      }
    }

    let isAllLiteral = false
    // walk declarations to record declared bindings
    if (
      (node.type === 'VariableDeclaration' ||
        node.type === 'FunctionDeclaration' ||
        node.type === 'ClassDeclaration' ||
        node.type === 'TSEnumDeclaration') &&
      !node.declare
    ) {
      isAllLiteral = walkDeclaration(node, setupBindings, vueImportAliases)
    }

    // hoist literal constants
    if (hoistStatic && isAllLiteral) {
      hoistNode(node)
    }

    // walk statements & named exports / variable declarations for top level
    // await
    if (
      (node.type === 'VariableDeclaration' && !node.declare) ||
      node.type.endsWith('Statement')
    ) {
      const scope: Statement[][] = [scriptSetupAst.body]
      ;(walk as any)(node, {
        enter(child: Node, parent: Node) {
          if (isFunctionType(child)) {
            this.skip()
          }
          if (child.type === 'BlockStatement') {
            scope.push(child.body)
          }
          if (child.type === 'AwaitExpression') {
            hasAwait = true
            // if the await expression is an expression statement and
            // - is in the root scope
            // - or is not the first statement in a nested block scope
            // then it needs a semicolon before the generated code.
            const currentScope = scope[scope.length - 1]
            const needsSemi = currentScope.some((n, i) => {
              return (
                (scope.length === 1 || i > 0) &&
                n.type === 'ExpressionStatement' &&
                n.start === child.start
              )
            })
            processAwait(
              child,
              needsSemi,
              parent.type === 'ExpressionStatement'
            )
          }
        },
        exit(node: Node) {
          if (node.type === 'BlockStatement') scope.pop()
        }
      })
    }

    if (
      (node.type === 'ExportNamedDeclaration' && node.exportKind !== 'type') ||
      node.type === 'ExportAllDeclaration' ||
      node.type === 'ExportDefaultDeclaration'
    ) {
      error(
        `<script setup> cannot contain ES module exports. ` +
          `If you are using a previous version of <script setup>, please ` +
          `consult the updated RFC at https://github.com/vuejs/rfcs/pull/227.`,
        node
      )
    }

    if (isTS) {
      // move all Type declarations to outer scope
      if (
        node.type.startsWith('TS') ||
        (node.type === 'ExportNamedDeclaration' &&
          node.exportKind === 'type') ||
        (node.type === 'VariableDeclaration' && node.declare)
      ) {
        recordType(node, declaredTypes)
        if (node.type !== 'TSEnumDeclaration') {
          hoistNode(node)
        }
      }
    }
  }

  // 3.1 props destructure transform
  if (propsDestructureDecl) {
    transformDestructuredProps(
      scriptSetupAst,
      s,
      startOffset,
      propsDestructuredBindings,
      error,
      vueImportAliases.watch
    )
  }

  // 3.2 Apply reactivity transform
  // TODO remove in 3.4
  if (
    enableReactivityTransform &&
    // normal <script> had ref bindings that maybe used in <script setup>
    (refBindings || shouldTransform(scriptSetup.content))
  ) {
    const { rootRefs, importedHelpers } = transformAST(
      scriptSetupAst,
      s,
      startOffset,
      refBindings
    )
    refBindings = refBindings ? [...refBindings, ...rootRefs] : rootRefs
    for (const h of importedHelpers) {
      helperImports.add(h)
    }
  }

  // 4. extract runtime props/emits code from setup context type
  if (propsTypeDecl) {
    extractRuntimeProps(propsTypeDecl, typeDeclaredProps, declaredTypes)
  }
  if (emitsTypeDecl) {
    extractRuntimeEmits(emitsTypeDecl, typeDeclaredEmits, error)
  }

  // 5. check macro args to make sure it doesn't reference setup scope
  // variables
  checkInvalidScopeReference(propsRuntimeDecl, DEFINE_PROPS)
  checkInvalidScopeReference(propsRuntimeDefaults, DEFINE_PROPS)
  checkInvalidScopeReference(propsDestructureDecl, DEFINE_PROPS)
  checkInvalidScopeReference(emitsRuntimeDecl, DEFINE_EMITS)
  checkInvalidScopeReference(optionsRuntimeDecl, DEFINE_OPTIONS)

  // 6. remove non-script content
  if (script) {
    if (startOffset < scriptStartOffset!) {
      // <script setup> before <script>
      s.remove(0, startOffset)
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

  // 7. analyze binding metadata
  if (scriptAst) {
    Object.assign(bindingMetadata, analyzeScriptBindings(scriptAst.body))
  }
  if (propsRuntimeDecl) {
    for (const key of getObjectOrArrayExpressionKeys(propsRuntimeDecl)) {
      bindingMetadata[key] = BindingTypes.PROPS
    }
  }
  for (const key in typeDeclaredProps) {
    bindingMetadata[key] = BindingTypes.PROPS
  }
  // props aliases
  if (propsDestructureDecl) {
    if (propsDestructureRestId) {
      bindingMetadata[propsDestructureRestId] =
        BindingTypes.SETUP_REACTIVE_CONST
    }
    for (const key in propsDestructuredBindings) {
      const { local } = propsDestructuredBindings[key]
      if (local !== key) {
        bindingMetadata[local] = BindingTypes.PROPS_ALIASED
        ;(bindingMetadata.__propsAliases ||
          (bindingMetadata.__propsAliases = {}))[local] = key
      }
    }
  }
  for (const [key, { isType, imported, source }] of Object.entries(
    userImports
  )) {
    if (isType) continue
    bindingMetadata[key] =
      imported === '*' ||
      (imported === 'default' && source.endsWith('.vue')) ||
      source === 'vue'
        ? BindingTypes.SETUP_CONST
        : BindingTypes.SETUP_MAYBE_REF
  }
  for (const key in scriptBindings) {
    bindingMetadata[key] = scriptBindings[key]
  }
  for (const key in setupBindings) {
    bindingMetadata[key] = setupBindings[key]
  }
  // known ref bindings
  if (refBindings) {
    for (const key of refBindings) {
      bindingMetadata[key] = BindingTypes.SETUP_REF
    }
  }

  // 8. inject `useCssVars` calls
  if (
    cssVars.length &&
    // no need to do this when targeting SSR
    !(options.inlineTemplate && options.templateOptions?.ssr)
  ) {
    helperImports.add(CSS_VARS_HELPER)
    helperImports.add('unref')
    s.prependLeft(
      startOffset,
      `\n${genCssVarsCode(cssVars, bindingMetadata, scopeId, isProd)}\n`
    )
  }

  // 9. finalize setup() argument signature
  let args = `__props`
  if (propsTypeDecl) {
    // mark as any and only cast on assignment
    // since the user defined complex types may be incompatible with the
    // inferred type from generated runtime declarations
    args += `: any`
  }
  // inject user assignment of props
  // we use a default __props so that template expressions referencing props
  // can use it directly
  if (propsIdentifier) {
    s.prependLeft(
      startOffset,
      `\nconst ${propsIdentifier} = __props${
        propsTypeDecl ? ` as ${genSetupPropsType(propsTypeDecl)}` : ``
      };\n`
    )
  }
  if (propsDestructureRestId) {
    s.prependLeft(
      startOffset,
      `\nconst ${propsDestructureRestId} = ${helper(
        `createPropsRestProxy`
      )}(__props, ${JSON.stringify(Object.keys(propsDestructuredBindings))});\n`
    )
  }
  // inject temp variables for async context preservation
  if (hasAwait) {
    const any = isTS ? `: any` : ``
    s.prependLeft(startOffset, `\nlet __temp${any}, __restore${any}\n`)
  }

  const destructureElements =
    hasDefineExposeCall || !options.inlineTemplate ? [`expose: __expose`] : []
  if (emitIdentifier) {
    destructureElements.push(
      emitIdentifier === `emit` ? `emit` : `emit: ${emitIdentifier}`
    )
  }
  if (destructureElements.length) {
    args += `, { ${destructureElements.join(', ')} }`
    if (emitsTypeDecl) {
      const content = emitsTypeDecl.__fromNormalScript
        ? script!.content
        : scriptSetup.content
      args += `: { emit: (${content.slice(
        emitsTypeDecl.start!,
        emitsTypeDecl.end!
      )}), expose: any, slots: any, attrs: any }`
    }
  }

  // 10. generate return statement
  let returned
  if (!options.inlineTemplate || (!sfc.template && hasDefaultExportRender)) {
    // non-inline mode, or has manual render in normal <script>
    // return bindings from script and script setup
    const allBindings: Record<string, any> = {
      ...scriptBindings,
      ...setupBindings
    }
    for (const key in userImports) {
      if (!userImports[key].isType && userImports[key].isUsedInTemplate) {
        allBindings[key] = true
      }
    }
    returned = `{ `
    for (const key in allBindings) {
      if (
        allBindings[key] === true &&
        userImports[key].source !== 'vue' &&
        !userImports[key].source.endsWith('.vue')
      ) {
        // generate getter for import bindings
        // skip vue imports since we know they will never change
        returned += `get ${key}() { return ${key} }, `
      } else if (bindingMetadata[key] === BindingTypes.SETUP_LET) {
        // local let binding, also add setter
        const setArg = key === 'v' ? `_v` : `v`
        returned +=
          `get ${key}() { return ${key} }, ` +
          `set ${key}(${setArg}) { ${key} = ${setArg} }, `
      } else {
        returned += `${key}, `
      }
    }
    returned = returned.replace(/, $/, '') + ` }`
  } else {
    // inline mode
    if (sfc.template && !sfc.template.src) {
      if (options.templateOptions && options.templateOptions.ssr) {
        hasInlinedSsrRenderFn = true
      }
      // inline render function mode - we are going to compile the template and
      // inline it right here
      const { code, ast, preamble, tips, errors } = compileTemplate({
        filename,
        source: sfc.template.content,
        inMap: sfc.template.map,
        ...options.templateOptions,
        id: scopeId,
        scoped: sfc.styles.some(s => s.scoped),
        isProd: options.isProd,
        ssrCssVars: sfc.cssVars,
        compilerOptions: {
          ...(options.templateOptions &&
            options.templateOptions.compilerOptions),
          inline: true,
          isTS,
          bindingMetadata
        }
      })
      if (tips.length) {
        tips.forEach(warnOnce)
      }
      const err = errors[0]
      if (typeof err === 'string') {
        throw new Error(err)
      } else if (err) {
        if (err.loc) {
          err.message +=
            `\n\n` +
            sfc.filename +
            '\n' +
            generateCodeFrame(
              source,
              err.loc.start.offset,
              err.loc.end.offset
            ) +
            `\n`
        }
        throw err
      }
      if (preamble) {
        s.prepend(preamble)
      }
      // avoid duplicated unref import
      // as this may get injected by the render function preamble OR the
      // css vars codegen
      if (ast && ast.helpers.has(UNREF)) {
        helperImports.delete('unref')
      }
      returned = code
    } else {
      returned = `() => {}`
    }
  }

  if (!options.inlineTemplate && !__TEST__) {
    // in non-inline mode, the `__isScriptSetup: true` flag is used by
    // componentPublicInstance proxy to allow properties that start with $ or _
    s.appendRight(
      endOffset,
      `\nconst __returned__ = ${returned}\n` +
        `Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })\n` +
        `return __returned__` +
        `\n}\n\n`
    )
  } else {
    s.appendRight(endOffset, `\nreturn ${returned}\n}\n\n`)
  }

  // 11. finalize default export
  let runtimeOptions = ``
  if (!hasDefaultExportName && filename && filename !== DEFAULT_FILENAME) {
    const match = filename.match(/([^/\\]+)\.\w+$/)
    if (match) {
      runtimeOptions += `\n  __name: '${match[1]}',`
    }
  }
  if (hasInlinedSsrRenderFn) {
    runtimeOptions += `\n  __ssrInlineRender: true,`
  }
  if (propsRuntimeDecl) {
    let declCode = scriptSetup.content
      .slice(propsRuntimeDecl.start!, propsRuntimeDecl.end!)
      .trim()
    if (propsDestructureDecl) {
      const defaults: string[] = []
      for (const key in propsDestructuredBindings) {
        const d = genDestructuredDefaultValue(key)
        if (d)
          defaults.push(
            `${key}: ${d.valueString}${
              d.needSkipFactory ? `, __skip_${key}: true` : ``
            }`
          )
      }
      if (defaults.length) {
        declCode = `${helper(
          `mergeDefaults`
        )}(${declCode}, {\n  ${defaults.join(',\n  ')}\n})`
      }
    }
    runtimeOptions += `\n  props: ${declCode},`
  } else if (propsTypeDecl) {
    runtimeOptions += genRuntimeProps(typeDeclaredProps)
  }
  if (emitsRuntimeDecl) {
    runtimeOptions += `\n  emits: ${scriptSetup.content
      .slice(emitsRuntimeDecl.start!, emitsRuntimeDecl.end!)
      .trim()},`
  } else if (emitsTypeDecl) {
    runtimeOptions += genRuntimeEmits(typeDeclaredEmits)
  }

  let definedOptions = ''
  if (optionsRuntimeDecl) {
    definedOptions = scriptSetup.content
      .slice(optionsRuntimeDecl.start!, optionsRuntimeDecl.end!)
      .trim()
  }

  // <script setup> components are closed by default. If the user did not
  // explicitly call `defineExpose`, call expose() with no args.
  const exposeCall =
    hasDefineExposeCall || options.inlineTemplate ? `` : `  __expose();\n`
  // wrap setup code with function.
  if (isTS) {
    // for TS, make sure the exported type is still valid type with
    // correct props information
    // we have to use object spread for types to be merged properly
    // user's TS setting should compile it down to proper targets
    // export default defineComponent({ ...__default__, ... })
    const def =
      (defaultExport ? `\n  ...${normalScriptDefaultVar},` : ``) +
      (definedOptions ? `\n  ...${definedOptions},` : '')
    s.prependLeft(
      startOffset,
      `\n${genDefaultAs} /*#__PURE__*/${helper(
        `defineComponent`
      )}({${def}${runtimeOptions}\n  ${
        hasAwait ? `async ` : ``
      }setup(${args}) {\n${exposeCall}`
    )
    s.appendRight(endOffset, `})`)
  } else {
    if (defaultExport || definedOptions) {
      // without TS, can't rely on rest spread, so we use Object.assign
      // export default Object.assign(__default__, { ... })
      s.prependLeft(
        startOffset,
        `\n${genDefaultAs} /*#__PURE__*/Object.assign(${
          defaultExport ? `${normalScriptDefaultVar}, ` : ''
        }${definedOptions ? `${definedOptions}, ` : ''}{${runtimeOptions}\n  ` +
          `${hasAwait ? `async ` : ``}setup(${args}) {\n${exposeCall}`
      )
      s.appendRight(endOffset, `})`)
    } else {
      s.prependLeft(
        startOffset,
        `\n${genDefaultAs} {${runtimeOptions}\n  ` +
          `${hasAwait ? `async ` : ``}setup(${args}) {\n${exposeCall}`
      )
      s.appendRight(endOffset, `}`)
    }
  }

  // 12. finalize Vue helper imports
  if (helperImports.size > 0) {
    s.prepend(
      `import { ${[...helperImports]
        .map(h => `${h} as _${h}`)
        .join(', ')} } from 'vue'\n`
    )
  }

  s.trim()

  return {
    ...scriptSetup,
    bindings: bindingMetadata,
    imports: userImports,
    content: s.toString(),
    map: genSourceMap
      ? (s.generateMap({
          source: filename,
          hires: true,
          includeContent: true
        }) as unknown as RawSourceMap)
      : undefined,
    scriptAst: scriptAst?.body,
    scriptSetupAst: scriptSetupAst?.body
  }
}

function registerBinding(
  bindings: Record<string, BindingTypes>,
  node: Identifier,
  type: BindingTypes
) {
  bindings[node.name] = type
}

function walkDeclaration(
  node: Declaration,
  bindings: Record<string, BindingTypes>,
  userImportAliases: Record<string, string>
): boolean {
  let isAllLiteral = false

  if (node.type === 'VariableDeclaration') {
    const isConst = node.kind === 'const'
    isAllLiteral =
      isConst &&
      node.declarations.every(
        decl => decl.id.type === 'Identifier' && isStaticNode(decl.init!)
      )

    // export const foo = ...
    for (const { id, init: _init } of node.declarations) {
      const init = _init && unwrapTSNode(_init)
      const isDefineCall = !!(
        isConst &&
        isCallOf(
          init,
          c => c === DEFINE_PROPS || c === DEFINE_EMITS || c === WITH_DEFAULTS
        )
      )
      if (id.type === 'Identifier') {
        let bindingType
        const userReactiveBinding = userImportAliases['reactive']
        if (isAllLiteral || (isConst && isStaticNode(init!))) {
          bindingType = BindingTypes.LITERAL_CONST
        } else if (isCallOf(init, userReactiveBinding)) {
          // treat reactive() calls as let since it's meant to be mutable
          bindingType = isConst
            ? BindingTypes.SETUP_REACTIVE_CONST
            : BindingTypes.SETUP_LET
        } else if (
          // if a declaration is a const literal, we can mark it so that
          // the generated render fn code doesn't need to unref() it
          isDefineCall ||
          (isConst && canNeverBeRef(init!, userReactiveBinding))
        ) {
          bindingType = isCallOf(init, DEFINE_PROPS)
            ? BindingTypes.SETUP_REACTIVE_CONST
            : BindingTypes.SETUP_CONST
        } else if (isConst) {
          if (isCallOf(init, userImportAliases['ref'])) {
            bindingType = BindingTypes.SETUP_REF
          } else {
            bindingType = BindingTypes.SETUP_MAYBE_REF
          }
        } else {
          bindingType = BindingTypes.SETUP_LET
        }
        registerBinding(bindings, id, bindingType)
      } else {
        if (isCallOf(init, DEFINE_PROPS)) {
          continue
        }
        if (id.type === 'ObjectPattern') {
          walkObjectPattern(id, bindings, isConst, isDefineCall)
        } else if (id.type === 'ArrayPattern') {
          walkArrayPattern(id, bindings, isConst, isDefineCall)
        }
      }
    }
  } else if (node.type === 'TSEnumDeclaration') {
    isAllLiteral = node.members.every(
      member => !member.initializer || isStaticNode(member.initializer)
    )
    bindings[node.id!.name] = isAllLiteral
      ? BindingTypes.LITERAL_CONST
      : BindingTypes.SETUP_CONST
  } else if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'ClassDeclaration'
  ) {
    // export function foo() {} / export class Foo {}
    // export declarations must be named.
    bindings[node.id!.name] = BindingTypes.SETUP_CONST
  }

  return isAllLiteral
}

function walkObjectPattern(
  node: ObjectPattern,
  bindings: Record<string, BindingTypes>,
  isConst: boolean,
  isDefineCall = false
) {
  for (const p of node.properties) {
    if (p.type === 'ObjectProperty') {
      if (p.key.type === 'Identifier' && p.key === p.value) {
        // shorthand: const { x } = ...
        const type = isDefineCall
          ? BindingTypes.SETUP_CONST
          : isConst
          ? BindingTypes.SETUP_MAYBE_REF
          : BindingTypes.SETUP_LET
        registerBinding(bindings, p.key, type)
      } else {
        walkPattern(p.value, bindings, isConst, isDefineCall)
      }
    } else {
      // ...rest
      // argument can only be identifier when destructuring
      const type = isConst ? BindingTypes.SETUP_CONST : BindingTypes.SETUP_LET
      registerBinding(bindings, p.argument as Identifier, type)
    }
  }
}

function walkArrayPattern(
  node: ArrayPattern,
  bindings: Record<string, BindingTypes>,
  isConst: boolean,
  isDefineCall = false
) {
  for (const e of node.elements) {
    e && walkPattern(e, bindings, isConst, isDefineCall)
  }
}

function walkPattern(
  node: Node,
  bindings: Record<string, BindingTypes>,
  isConst: boolean,
  isDefineCall = false
) {
  if (node.type === 'Identifier') {
    const type = isDefineCall
      ? BindingTypes.SETUP_CONST
      : isConst
      ? BindingTypes.SETUP_MAYBE_REF
      : BindingTypes.SETUP_LET
    registerBinding(bindings, node, type)
  } else if (node.type === 'RestElement') {
    // argument can only be identifier when destructuring
    const type = isConst ? BindingTypes.SETUP_CONST : BindingTypes.SETUP_LET
    registerBinding(bindings, node.argument as Identifier, type)
  } else if (node.type === 'ObjectPattern') {
    walkObjectPattern(node, bindings, isConst)
  } else if (node.type === 'ArrayPattern') {
    walkArrayPattern(node, bindings, isConst)
  } else if (node.type === 'AssignmentPattern') {
    if (node.left.type === 'Identifier') {
      const type = isDefineCall
        ? BindingTypes.SETUP_CONST
        : isConst
        ? BindingTypes.SETUP_MAYBE_REF
        : BindingTypes.SETUP_LET
      registerBinding(bindings, node.left, type)
    } else {
      walkPattern(node.left, bindings, isConst)
    }
  }
}

interface PropTypeData {
  key: string
  type: string[]
  required: boolean
  skipCheck: boolean
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
  } else if (node.type === 'TSEnumDeclaration') {
    declaredTypes[node.id.name] = inferEnumType(node)
  }
}

function extractRuntimeProps(
  node: TSTypeLiteral | TSInterfaceBody,
  props: Record<string, PropTypeData>,
  declaredTypes: Record<string, string[]>
) {
  const members = node.type === 'TSTypeLiteral' ? node.members : node.body
  for (const m of members) {
    if (
      (m.type === 'TSPropertySignature' || m.type === 'TSMethodSignature') &&
      m.key.type === 'Identifier'
    ) {
      let type: string[] | undefined
      let skipCheck = false
      if (m.type === 'TSMethodSignature') {
        type = ['Function']
      } else if (m.typeAnnotation) {
        type = inferRuntimeType(m.typeAnnotation.typeAnnotation, declaredTypes)
        // skip check for result containing unknown types
        if (type.includes(UNKNOWN_TYPE)) {
          if (type.includes('Boolean') || type.includes('Function')) {
            type = type.filter(t => t !== UNKNOWN_TYPE)
            skipCheck = true
          } else {
            type = ['null']
          }
        }
      }
      props[m.key.name] = {
        key: m.key.name,
        required: !m.optional,
        type: type || [`null`],
        skipCheck
      }
    }
  }
}

const UNKNOWN_TYPE = 'Unknown'

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
    case 'TSNullKeyword':
      return ['null']
    case 'TSTypeLiteral': {
      // TODO (nice to have) generate runtime property validation
      const types = new Set<string>()
      for (const m of node.members) {
        if (
          m.type === 'TSCallSignatureDeclaration' ||
          m.type === 'TSConstructSignatureDeclaration'
        ) {
          types.add('Function')
        } else {
          types.add('Object')
        }
      }
      return types.size ? Array.from(types) : ['Object']
    }
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
          return [UNKNOWN_TYPE]
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
          case 'Date':
          case 'Promise':
            return [node.typeName.name]

          // TS built-in utility types
          // https://www.typescriptlang.org/docs/handbook/utility-types.html
          case 'Partial':
          case 'Required':
          case 'Readonly':
          case 'Record':
          case 'Pick':
          case 'Omit':
          case 'InstanceType':
            return ['Object']

          case 'Uppercase':
          case 'Lowercase':
          case 'Capitalize':
          case 'Uncapitalize':
            return ['String']

          case 'Parameters':
          case 'ConstructorParameters':
            return ['Array']

          case 'NonNullable':
            if (node.typeParameters && node.typeParameters.params[0]) {
              return inferRuntimeType(
                node.typeParameters.params[0],
                declaredTypes
              ).filter(t => t !== 'null')
            }
            break
          case 'Extract':
            if (node.typeParameters && node.typeParameters.params[1]) {
              return inferRuntimeType(
                node.typeParameters.params[1],
                declaredTypes
              )
            }
            break
          case 'Exclude':
          case 'OmitThisParameter':
            if (node.typeParameters && node.typeParameters.params[0]) {
              return inferRuntimeType(
                node.typeParameters.params[0],
                declaredTypes
              )
            }
            break
        }
      }
      // cannot infer, fallback to UNKNOWN: ThisParameterType
      return [UNKNOWN_TYPE]

    case 'TSParenthesizedType':
      return inferRuntimeType(node.typeAnnotation, declaredTypes)

    case 'TSUnionType':
      return flattenTypes(node.types, declaredTypes)
    case 'TSIntersectionType': {
      return flattenTypes(node.types, declaredTypes).filter(
        t => t !== UNKNOWN_TYPE
      )
    }

    case 'TSSymbolKeyword':
      return ['Symbol']

    default:
      return [UNKNOWN_TYPE] // no runtime check
  }
}

function flattenTypes(
  types: TSType[],
  declaredTypes: Record<string, string[]>
): string[] {
  return [
    ...new Set(
      ([] as string[]).concat(
        ...types.map(t => inferRuntimeType(t, declaredTypes))
      )
    )
  ]
}

function toRuntimeTypeString(types: string[]) {
  return types.length > 1 ? `[${types.join(', ')}]` : types[0]
}

function inferEnumType(node: TSEnumDeclaration): string[] {
  const types = new Set<string>()
  for (const m of node.members) {
    if (m.initializer) {
      switch (m.initializer.type) {
        case 'StringLiteral':
          types.add('String')
          break
        case 'NumericLiteral':
          types.add('Number')
          break
      }
    }
  }
  return types.size ? [...types] : ['Number']
}

// non-comprehensive, best-effort type infernece for a runtime value
// this is used to catch default value / type declaration mismatches
// when using props destructure.
function inferValueType(node: Node): string | undefined {
  switch (node.type) {
    case 'StringLiteral':
      return 'String'
    case 'NumericLiteral':
      return 'Number'
    case 'BooleanLiteral':
      return 'Boolean'
    case 'ObjectExpression':
      return 'Object'
    case 'ArrayExpression':
      return 'Array'
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return 'Function'
  }
}

function extractRuntimeEmits(
  node: TSFunctionType | TSTypeLiteral | TSInterfaceBody,
  emits: Set<string>,
  error: (msg: string, node: Node) => never
) {
  if (node.type === 'TSTypeLiteral' || node.type === 'TSInterfaceBody') {
    const members = node.type === 'TSTypeLiteral' ? node.members : node.body
    let hasCallSignature = false
    let hasProperty = false
    for (let t of members) {
      if (t.type === 'TSCallSignatureDeclaration') {
        extractEventNames(t.parameters[0], emits)
        hasCallSignature = true
      }
      if (t.type === 'TSPropertySignature') {
        if (t.key.type !== 'Identifier' || t.computed) {
          error(`defineEmits() type cannot use computed keys.`, t.key)
        }
        emits.add(t.key.name)
        hasProperty = true
      }
    }
    if (hasCallSignature && hasProperty) {
      error(
        `defineEmits() type cannot mixed call signature and property syntax.`,
        node
      )
    }
    return
  } else {
    extractEventNames(node.parameters[0], emits)
  }
}

function extractEventNames(
  eventName: Identifier | RestElement,
  emits: Set<string>
) {
  if (
    eventName.type === 'Identifier' &&
    eventName.typeAnnotation &&
    eventName.typeAnnotation.type === 'TSTypeAnnotation'
  ) {
    const typeNode = eventName.typeAnnotation.typeAnnotation
    if (typeNode.type === 'TSLiteralType') {
      if (
        typeNode.literal.type !== 'UnaryExpression' &&
        typeNode.literal.type !== 'TemplateLiteral'
      ) {
        emits.add(String(typeNode.literal.value))
      }
    } else if (typeNode.type === 'TSUnionType') {
      for (const t of typeNode.types) {
        if (
          t.type === 'TSLiteralType' &&
          t.literal.type !== 'UnaryExpression' &&
          t.literal.type !== 'TemplateLiteral'
        ) {
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
        .join(', ')}],`
    : ``
}

function canNeverBeRef(node: Node, userReactiveImport?: string): boolean {
  if (isCallOf(node, userReactiveImport)) {
    return true
  }
  switch (node.type) {
    case 'UnaryExpression':
    case 'BinaryExpression':
    case 'ArrayExpression':
    case 'ObjectExpression':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
    case 'UpdateExpression':
    case 'ClassExpression':
    case 'TaggedTemplateExpression':
      return true
    case 'SequenceExpression':
      return canNeverBeRef(
        node.expressions[node.expressions.length - 1],
        userReactiveImport
      )
    default:
      if (isLiteralNode(node)) {
        return true
      }
      return false
  }
}

function isStaticNode(node: Node): boolean {
  switch (node.type) {
    case 'UnaryExpression': // void 0, !true
      return isStaticNode(node.argument)

    case 'LogicalExpression': // 1 > 2
    case 'BinaryExpression': // 1 + 2
      return isStaticNode(node.left) && isStaticNode(node.right)

    case 'ConditionalExpression': {
      // 1 ? 2 : 3
      return (
        isStaticNode(node.test) &&
        isStaticNode(node.consequent) &&
        isStaticNode(node.alternate)
      )
    }

    case 'SequenceExpression': // (1, 2)
    case 'TemplateLiteral': // `foo${1}`
      return node.expressions.every(expr => isStaticNode(expr))

    case 'ParenthesizedExpression': // (1)
    case 'TSNonNullExpression': // 1!
    case 'TSAsExpression': // 1 as number
    case 'TSTypeAssertion': // (<number>2)
      return isStaticNode(node.expression)

    default:
      if (isLiteralNode(node)) {
        return true
      }
      return false
  }
}

function isLiteralNode(node: Node) {
  return node.type.endsWith('Literal')
}

/**
 * Analyze bindings in normal `<script>`
 * Note that `compileScriptSetup` already analyzes bindings as part of its
 * compilation process so this should only be used on single `<script>` SFCs.
 */
function analyzeScriptBindings(ast: Statement[]): BindingMetadata {
  for (const node of ast) {
    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'ObjectExpression'
    ) {
      return analyzeBindingsFromOptions(node.declaration)
    }
  }
  return {}
}

function analyzeBindingsFromOptions(node: ObjectExpression): BindingMetadata {
  const bindings: BindingMetadata = {}
  // #3270, #3275
  // mark non-script-setup so we don't resolve components/directives from these
  Object.defineProperty(bindings, '__isScriptSetup', {
    enumerable: false,
    value: false
  })
  for (const property of node.properties) {
    if (
      property.type === 'ObjectProperty' &&
      !property.computed &&
      property.key.type === 'Identifier'
    ) {
      // props
      if (property.key.name === 'props') {
        // props: ['foo']
        // props: { foo: ... }
        for (const key of getObjectOrArrayExpressionKeys(property.value)) {
          bindings[key] = BindingTypes.PROPS
        }
      }

      // inject
      else if (property.key.name === 'inject') {
        // inject: ['foo']
        // inject: { foo: {} }
        for (const key of getObjectOrArrayExpressionKeys(property.value)) {
          bindings[key] = BindingTypes.OPTIONS
        }
      }

      // computed & methods
      else if (
        property.value.type === 'ObjectExpression' &&
        (property.key.name === 'computed' || property.key.name === 'methods')
      ) {
        // methods: { foo() {} }
        // computed: { foo() {} }
        for (const key of getObjectExpressionKeys(property.value)) {
          bindings[key] = BindingTypes.OPTIONS
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
            bindings[key] =
              property.key.name === 'setup'
                ? BindingTypes.SETUP_MAYBE_REF
                : BindingTypes.DATA
          }
        }
      }
    }
  }

  return bindings
}

function getObjectExpressionKeys(node: ObjectExpression): string[] {
  const keys = []
  for (const prop of node.properties) {
    if (prop.type === 'SpreadElement') continue
    const key = resolveObjectKey(prop.key, prop.computed)
    if (key) keys.push(String(key))
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

function getObjectOrArrayExpressionKeys(value: Node): string[] {
  if (value.type === 'ArrayExpression') {
    return getArrayExpressionKeys(value)
  }
  if (value.type === 'ObjectExpression') {
    return getObjectExpressionKeys(value)
  }
  return []
}

const templateUsageCheckCache = createCache<string>()

function resolveTemplateUsageCheckString(sfc: SFCDescriptor) {
  const { content, ast } = sfc.template!
  const cached = templateUsageCheckCache.get(content)
  if (cached) {
    return cached
  }

  let code = ''
  transform(createRoot([ast]), {
    nodeTransforms: [
      node => {
        if (node.type === NodeTypes.ELEMENT) {
          if (
            !parserOptions.isNativeTag!(node.tag) &&
            !parserOptions.isBuiltInComponent!(node.tag)
          ) {
            code += `,${camelize(node.tag)},${capitalize(camelize(node.tag))}`
          }
          for (let i = 0; i < node.props.length; i++) {
            const prop = node.props[i]
            if (prop.type === NodeTypes.DIRECTIVE) {
              if (!isBuiltInDir(prop.name)) {
                code += `,v${capitalize(camelize(prop.name))}`
              }
              if (prop.exp) {
                code += `,${processExp(
                  (prop.exp as SimpleExpressionNode).content,
                  prop.name
                )}`
              }
            }
          }
        } else if (node.type === NodeTypes.INTERPOLATION) {
          code += `,${processExp(
            (node.content as SimpleExpressionNode).content
          )}`
        }
      }
    ]
  })

  code += ';'
  templateUsageCheckCache.set(content, code)
  return code
}

const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/

function processExp(exp: string, dir?: string): string {
  if (/ as\s+\w|<.*>|:/.test(exp)) {
    if (dir === 'slot') {
      exp = `(${exp})=>{}`
    } else if (dir === 'on') {
      exp = `()=>{return ${exp}}`
    } else if (dir === 'for') {
      const inMatch = exp.match(forAliasRE)
      if (inMatch) {
        const [, LHS, RHS] = inMatch
        return processExp(`(${LHS})=>{}`) + processExp(RHS)
      }
    }
    let ret = ''
    // has potential type cast or generic arguments that uses types
    const ast = parseExpression(exp, { plugins: ['typescript'] })
    walkIdentifiers(ast, node => {
      ret += `,` + node.name
    })
    return ret
  }
  return stripStrings(exp)
}

function stripStrings(exp: string) {
  return exp
    .replace(/'[^']*'|"[^"]*"/g, '')
    .replace(/`[^`]+`/g, stripTemplateString)
}

function stripTemplateString(str: string): string {
  const interpMatch = str.match(/\${[^}]+}/g)
  if (interpMatch) {
    return interpMatch.map(m => m.slice(2, -1)).join(',')
  }
  return ''
}

function isImportUsed(local: string, sfc: SFCDescriptor): boolean {
  return new RegExp(
    // #4274 escape $ since it's a special char in regex
    // (and is the only regex special char that is valid in identifiers)
    `[^\\w$_]${local.replace(/\$/g, '\\$')}[^\\w$_]`
  ).test(resolveTemplateUsageCheckString(sfc))
}

/**
 * Note: this comparison assumes the prev/next script are already identical,
 * and only checks the special case where <script setup lang="ts"> unused import
 * pruning result changes due to template changes.
 */
export function hmrShouldReload(
  prevImports: Record<string, ImportBinding>,
  next: SFCDescriptor
): boolean {
  if (
    !next.scriptSetup ||
    (next.scriptSetup.lang !== 'ts' && next.scriptSetup.lang !== 'tsx')
  ) {
    return false
  }

  // for each previous import, check if its used status remain the same based on
  // the next descriptor's template
  for (const key in prevImports) {
    // if an import was previous unused, but now is used, we need to force
    // reload so that the script now includes that import.
    if (!prevImports[key].isUsedInTemplate && isImportUsed(key, next)) {
      return true
    }
  }

  return false
}

export function resolveObjectKey(node: Node, computed: boolean) {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
      return node.value
    case 'Identifier':
      if (!computed) return node.name
  }
  return undefined
}
