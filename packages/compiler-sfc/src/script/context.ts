import { Node, ObjectPattern, Program } from '@babel/types'
import { SFCDescriptor } from '../parse'
import { generateCodeFrame } from '@vue/shared'
import { parse as babelParse, ParserOptions, ParserPlugin } from '@babel/parser'
import { ImportBinding, SFCScriptCompileOptions } from '../compileScript'
import { PropsDestructureBindings } from './defineProps'
import { ModelDecl } from './defineModel'
import { BindingMetadata } from '../../../compiler-core/src'
import MagicString from 'magic-string'
import { TypeScope } from './resolveType'

export class ScriptCompileContext {
  isJS: boolean
  isTS: boolean

  scriptAst: Program | null
  scriptSetupAst: Program | null

  s = new MagicString(this.descriptor.source)
  startOffset = this.descriptor.scriptSetup?.loc.start.offset
  endOffset = this.descriptor.scriptSetup?.loc.end.offset

  // import / type analysis
  scope: TypeScope | undefined
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
  propsIdentifier: string | undefined
  propsRuntimeDecl: Node | undefined
  propsTypeDecl: Node | undefined
  propsDestructureDecl: ObjectPattern | undefined
  propsDestructuredBindings: PropsDestructureBindings = Object.create(null)
  propsDestructureRestId: string | undefined
  propsRuntimeDefaults: Node | undefined

  // defineEmits
  emitsRuntimeDecl: Node | undefined
  emitsTypeDecl: Node | undefined
  emitIdentifier: string | undefined

  // defineModel
  modelDecls: Record<string, ModelDecl> = {}

  // defineOptions
  optionsRuntimeDecl: Node | undefined

  // codegen
  bindingMetadata: BindingMetadata = {}

  helperImports: Set<string> = new Set()
  helper(key: string): string {
    this.helperImports.add(key)
    return `_${key}`
  }

  constructor(
    public descriptor: SFCDescriptor,
    public options: SFCScriptCompileOptions
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

    // resolve parser plugins
    const plugins: ParserPlugin[] = []
    if (!this.isTS || scriptLang === 'tsx' || scriptSetupLang === 'tsx') {
      plugins.push('jsx')
    } else {
      // If don't match the case of adding jsx, should remove the jsx from the babelParserPlugins
      if (options.babelParserPlugins)
        options.babelParserPlugins = options.babelParserPlugins.filter(
          n => n !== 'jsx'
        )
    }
    if (options.babelParserPlugins) plugins.push(...options.babelParserPlugins)
    if (this.isTS) {
      plugins.push('typescript')
      if (!plugins.includes('decorators')) {
        plugins.push('decorators-legacy')
      }
    }

    function parse(
      input: string,
      options: ParserOptions,
      offset: number
    ): Program {
      try {
        return babelParse(input, options).program
      } catch (e: any) {
        e.message = `[@vue/compiler-sfc] ${e.message}\n\n${
          descriptor.filename
        }\n${generateCodeFrame(
          descriptor.source,
          e.pos + offset,
          e.pos + offset + 1
        )}`
        throw e
      }
    }

    this.scriptAst =
      this.descriptor.script &&
      parse(
        this.descriptor.script.content,
        {
          plugins,
          sourceType: 'module'
        },
        this.descriptor.script.loc.start.offset
      )

    this.scriptSetupAst =
      this.descriptor.scriptSetup &&
      parse(
        this.descriptor.scriptSetup!.content,
        {
          plugins: [...plugins, 'topLevelAwait'],
          sourceType: 'module'
        },
        this.startOffset!
      )
  }

  getString(node: Node, scriptSetup = true): string {
    const block = scriptSetup
      ? this.descriptor.scriptSetup!
      : this.descriptor.script!
    return block.content.slice(node.start!, node.end!)
  }

  error(
    msg: string,
    node: Node,
    end: number = node.end! + this.startOffset!
  ): never {
    throw new Error(
      `[@vue/compiler-sfc] ${msg}\n\n${
        this.descriptor.filename
      }\n${generateCodeFrame(
        this.descriptor.source,
        node.start! + this.startOffset!,
        end
      )}`
    )
  }
}
