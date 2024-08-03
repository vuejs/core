import type { CallExpression, Node, ObjectPattern, Program } from '@babel/types'
import type { SFCDescriptor } from '../parse'
import { generateCodeFrame, isArray } from '@vue/shared'
import { type ParserPlugin, parse as babelParse } from '@babel/parser'
import type { ImportBinding, SFCScriptCompileOptions } from '../compileScript'
import type { PropsDestructureBindings } from './defineProps'
import type { ModelDecl } from './defineModel'
import type { BindingMetadata } from '../../../compiler-core/src'
import MagicString from 'magic-string'
import type { TypeScope } from './resolveType'

export class ScriptCompileContext {
  isJS: boolean
  isTS: boolean
  isCE = false

  scriptAst: Program | null
  scriptSetupAst: Program | null

  source = this.descriptor.source
  filename = this.descriptor.filename
  s = new MagicString(this.source)
  startOffset = this.descriptor.scriptSetup?.loc.start.offset
  endOffset = this.descriptor.scriptSetup?.loc.end.offset

  // import / type analysis
  scope?: TypeScope
  globalScopes?: TypeScope[]
  userImports: Record<string, ImportBinding> = Object.create(null)

  // macros presence check
  hasDefinePropsCall = false
  hasDefineEmitCall = false
  hasDefineExposeCall = false
  hasDefaultExportName = false
  hasDefaultExportRender = false
  hasDefineOptionsCall = false
  hasDefineSlotsCall = false
  hasDefineModelCall = false

  // defineProps
  propsCall: CallExpression | undefined
  propsDecl: Node | undefined
  propsRuntimeDecl: Node | undefined
  propsTypeDecl: Node | undefined
  propsDestructureDecl: ObjectPattern | undefined
  propsDestructuredBindings: PropsDestructureBindings = Object.create(null)
  propsDestructureRestId: string | undefined
  propsRuntimeDefaults: Node | undefined

  // defineEmits
  emitsRuntimeDecl: Node | undefined
  emitsTypeDecl: Node | undefined
  emitDecl: Node | undefined

  // defineModel
  modelDecls: Record<string, ModelDecl> = Object.create(null)

  // defineOptions
  optionsRuntimeDecl: Node | undefined

  // codegen
  bindingMetadata: BindingMetadata = {}
  helperImports: Set<string> = new Set()
  helper(key: string): string {
    this.helperImports.add(key)
    return `_${key}`
  }

  /**
   * to be exposed on compiled script block for HMR cache busting
   */
  deps?: Set<string>

  /**
   * cache for resolved fs
   */
  fs?: NonNullable<SFCScriptCompileOptions['fs']>

  constructor(
    public descriptor: SFCDescriptor,
    public options: Partial<SFCScriptCompileOptions>,
  ) {
    const { script, scriptSetup } = descriptor
    const scriptLang = script && script.lang
    const scriptSetupLang = scriptSetup && scriptSetup.lang

    this.isJS =
      scriptLang === 'js' ||
      scriptLang === 'jsx' ||
      scriptSetupLang === 'js' ||
      scriptSetupLang === 'jsx'
    this.isTS =
      scriptLang === 'ts' ||
      scriptLang === 'tsx' ||
      scriptSetupLang === 'ts' ||
      scriptSetupLang === 'tsx'

    const customElement = options.customElement
    const filename = this.descriptor.filename
    if (customElement) {
      this.isCE =
        typeof customElement === 'boolean'
          ? customElement
          : customElement(filename)
    }
    // resolve parser plugins
    const plugins: ParserPlugin[] = resolveParserPlugins(
      (scriptLang || scriptSetupLang)!,
      options.babelParserPlugins,
    )

    function parse(input: string, offset: number): Program {
      try {
        return babelParse(input, {
          plugins,
          sourceType: 'module',
        }).program
      } catch (e: any) {
        e.message = `[vue/compiler-sfc] ${e.message}\n\n${
          descriptor.filename
        }\n${generateCodeFrame(
          descriptor.source,
          e.pos + offset,
          e.pos + offset + 1,
        )}`
        throw e
      }
    }

    this.scriptAst =
      descriptor.script &&
      parse(descriptor.script.content, descriptor.script.loc.start.offset)

    this.scriptSetupAst =
      descriptor.scriptSetup &&
      parse(descriptor.scriptSetup!.content, this.startOffset!)
  }

  getString(node: Node, scriptSetup = true): string {
    const block = scriptSetup
      ? this.descriptor.scriptSetup!
      : this.descriptor.script!
    return block.content.slice(node.start!, node.end!)
  }

  error(msg: string, node: Node, scope?: TypeScope): never {
    const offset = scope ? scope.offset : this.startOffset!
    throw new Error(
      `[@vue/compiler-sfc] ${msg}\n\n${
        (scope || this.descriptor).filename
      }\n${generateCodeFrame(
        (scope || this.descriptor).source,
        node.start! + offset,
        node.end! + offset,
      )}`,
    )
  }
}

export function resolveParserPlugins(
  lang: string,
  userPlugins?: ParserPlugin[],
  dts = false,
) {
  const plugins: ParserPlugin[] = []
  if (
    !userPlugins ||
    !userPlugins.some(
      p =>
        p === 'importAssertions' ||
        p === 'importAttributes' ||
        (isArray(p) && p[0] === 'importAttributes'),
    )
  ) {
    plugins.push('importAttributes')
  }
  if (lang === 'jsx' || lang === 'tsx' || lang === 'mtsx') {
    plugins.push('jsx')
  } else if (userPlugins) {
    // If don't match the case of adding jsx
    // should remove the jsx from user options
    userPlugins = userPlugins.filter(p => p !== 'jsx')
  }
  if (lang === 'ts' || lang === 'mts' || lang === 'tsx' || lang === 'mtsx') {
    plugins.push(['typescript', { dts }], 'explicitResourceManagement')
    if (!userPlugins || !userPlugins.includes('decorators')) {
      plugins.push('decorators-legacy')
    }
  }
  if (userPlugins) {
    plugins.push(...userPlugins)
  }
  return plugins
}
