import type {
  BaseCodegenResult,
  CodegenPiece,
  CompilerError,
  CompilerOptions,
  NodeTransform,
  ParserOptions,
  RawSourceMap,
  RootNode,
} from '@vue/compiler-core'
import {
  type SourceMapSegment,
  decodeMappings,
  encodeMappings,
} from 'muggle-string'
import {
  type AssetURLOptions,
  type AssetURLTagConfig,
  createAssetUrlTransformWithOptions,
  normalizeOptions,
  transformAssetUrl,
} from './template/transformAssetUrl'
import {
  createSrcsetTransformWithOptions,
  transformSrcset,
} from './template/transformSrcset'
import { generateCodeFrame, isObject } from '@vue/shared'
import * as CompilerDOM from '@vue/compiler-dom'
import * as CompilerVapor from '@vue/compiler-vapor'
import * as CompilerSSR from '@vue/compiler-ssr'
import consolidate from '@vue/consolidate'
import { warnOnce } from './warn'
import { genCssVarsFromList } from './style/cssVars'
import { resolveTemplateAST } from './template/resolveTemplateAST'

export interface TemplateCompiler {
  compile(
    source: string | RootNode,
    options: CompilerOptions,
  ): BaseCodegenResult
  parse(template: string, options: ParserOptions): RootNode
}

export interface SFCTemplateCompileResults {
  code: string
  ast?: unknown
  preamble?: string
  source: string
  tips: string[]
  errors: (string | CompilerError)[]
  map?: RawSourceMap
  /** @internal The pieces the map is rendered from, if its sources are the compiled ones */
  pieces?: CodegenPiece[]
  helpers?: Set<string | symbol>
}

export interface SFCTemplateCompileOptions {
  source: string
  ast?: RootNode
  filename: string
  id: string
  scoped?: boolean
  slotted?: boolean
  isProd?: boolean
  vapor?: boolean
  ssr?: boolean
  ssrCssVars?: string[]
  inMap?: RawSourceMap
  compiler?: TemplateCompiler
  compilerOptions?: CompilerOptions
  preprocessLang?: string
  preprocessOptions?: any
  /**
   * In some cases, compiler-sfc may not be inside the project root (e.g. when
   * linked or globally installed). In such cases a custom `require` can be
   * passed to correctly resolve the preprocessors.
   */
  preprocessCustomRequire?: (id: string) => any
  /**
   * Configure what tags/attributes to transform into asset url imports,
   * or disable the transform altogether with `false`.
   */
  transformAssetUrls?: AssetURLOptions | AssetURLTagConfig | boolean
}

interface PreProcessor {
  render(
    source: string,
    options: any,
    cb: (err: Error | null, res: string) => void,
  ): void
}

function preprocess(
  { source, filename, preprocessOptions }: SFCTemplateCompileOptions,
  preprocessor: PreProcessor,
): string {
  // Consolidate exposes a callback based API, but the callback is in fact
  // called synchronously for most templating engines. In our case, we have to
  // expose a synchronous API so that it is usable in Jest transforms (which
  // have to be sync because they are applied via Node.js require hooks)
  let res: string = ''
  let err: Error | null = null

  preprocessor.render(
    source,
    { filename, ...preprocessOptions },
    (_err, _res) => {
      if (_err) err = _err
      res = _res
    },
  )

  if (err) throw err
  return res
}

export function compileTemplate(
  options: SFCTemplateCompileOptions,
): SFCTemplateCompileResults {
  const { preprocessLang, preprocessCustomRequire } = options

  if (
    (__ESM_BROWSER__ || __GLOBAL__) &&
    preprocessLang &&
    !preprocessCustomRequire
  ) {
    throw new Error(
      `[@vue/compiler-sfc] Template preprocessing in the browser build must ` +
        `provide the \`preprocessCustomRequire\` option to return the in-browser ` +
        `version of the preprocessor in the shape of { render(): string }.`,
    )
  }

  const preprocessor = preprocessLang
    ? preprocessCustomRequire
      ? preprocessCustomRequire(preprocessLang)
      : __ESM_BROWSER__
        ? undefined
        : consolidate[preprocessLang as keyof typeof consolidate]
    : false
  if (preprocessor) {
    try {
      return doCompileTemplate({
        ...options,
        source: preprocess(options, preprocessor),
        ast: undefined, // invalidate AST if template goes through preprocessor
      })
    } catch (e: any) {
      return {
        code: `export default function render() {}`,
        source: options.source,
        tips: [],
        errors: [e],
      }
    }
  } else if (preprocessLang) {
    return {
      code: `export default function render() {}`,
      source: options.source,
      tips: [
        `Component ${options.filename} uses lang ${preprocessLang} for template. Please install the language preprocessor.`,
      ],
      errors: [
        `Component ${options.filename} uses lang ${preprocessLang} for template, however it is not installed.`,
      ],
    }
  } else {
    return doCompileTemplate(options)
  }
}

function doCompileTemplate({
  filename,
  id,
  scoped,
  slotted,
  inMap,
  source,
  ast: inAST,
  ssr = false,
  vapor = false,
  ssrCssVars,
  isProd = false,
  compiler,
  compilerOptions = {},
  transformAssetUrls,
}: SFCTemplateCompileOptions): SFCTemplateCompileResults {
  const errors: CompilerError[] = []
  const warnings: CompilerError[] = []

  let nodeTransforms: NodeTransform[] = []
  if (isObject(transformAssetUrls)) {
    const assetOptions = normalizeOptions(transformAssetUrls)
    nodeTransforms = [
      createAssetUrlTransformWithOptions(assetOptions),
      createSrcsetTransformWithOptions(assetOptions),
    ]
  } else if (transformAssetUrls !== false) {
    nodeTransforms = [transformAssetUrl, transformSrcset]
  }

  if (ssr && !ssrCssVars) {
    warnOnce(
      `compileTemplate is called with \`ssr: true\` but no ` +
        `corresponding \`cssVars\` option.`,
    )
  }
  if (!id) {
    warnOnce(`compileTemplate now requires the \`id\` option.`)
    id = ''
  }

  const shortId = id.replace(/^data-v-/, '')
  const longId = `data-v-${shortId}`

  const defaultCompiler = ssr
    ? (CompilerSSR as TemplateCompiler)
    : vapor
      ? (CompilerVapor as TemplateCompiler)
      : CompilerDOM
  compiler = compiler || defaultCompiler

  if (compiler !== defaultCompiler) {
    // user using custom compiler, this means we cannot reuse the AST from
    // the descriptor as they might be different.
    inAST = undefined
  }

  inAST = resolveTemplateAST(inAST, {
    compiler,
    compilerOptions,
    ssr,
    onError: e => errors.push(e),
  })

  let { code, ast, preamble, map, pieces, helpers } = compiler.compile(
    inAST || source,
    {
      mode: 'module',
      prefixIdentifiers: true,
      hoistStatic: true,
      cacheHandlers: true,
      ssrCssVars:
        ssr && ssrCssVars && ssrCssVars.length
          ? genCssVarsFromList(ssrCssVars, shortId, isProd, true)
          : '',
      scopeId: scoped ? longId : undefined,
      slotted,
      sourceMap: true,
      vapor: ssr && vapor,
      ...compilerOptions,
      // Template-only vapor SFCs have no script analysis, but compiler-vapor
      // still needs bindingMetadata to keep built-in render args like $slots.
      bindingMetadata:
        vapor && !ssr && compilerOptions.bindingMetadata == null
          ? {}
          : compilerOptions.bindingMetadata,
      hmr: !isProd,
      nodeTransforms: nodeTransforms.concat(
        compilerOptions.nodeTransforms || [],
      ),
      filename,
      onError: e => errors.push(e),
      onWarn: w => warnings.push(w),
    },
  )

  // inMap should be the map produced by ./parse.ts which is a simple line-only
  // mapping. If it is present, we need to adjust the final map and errors to
  // reflect the original line numbers.
  if (inMap && !inAST) {
    if (map) {
      map = shiftMap(inMap, map)
      pieces = undefined
    }
    if (errors.length) {
      patchErrors(errors, source, inMap)
    }
  }

  const tips = warnings.map(w => {
    let msg = w.message
    if (w.loc) {
      msg += `\n${generateCodeFrame(
        inAST?.source || source,
        w.loc.start.offset,
        w.loc.end.offset,
      )}`
    }
    return msg
  })

  return {
    code,
    ast,
    preamble,
    source,
    errors,
    tips,
    map,
    pieces,
    helpers,
  }
}

// `inMap` maps `source` by a shift of lines and columns, which its first
// segment with a source gives
function shiftMap(inMap: RawSourceMap, map: RawSourceMap): RawSourceMap {
  // decode only up to the first segment, unless it has no source
  let lines = decodeMappings(/^;*[^,;]*/.exec(inMap.mappings)![0])
  if (lines[lines.length - 1].every(s => s.length === 1)) {
    lines = decodeMappings(inMap.mappings)
  }
  const line = lines.findIndex(segments => segments.some(s => s.length !== 1))
  if (line < 0) return map
  const first = lines[line].find(s => s.length !== 1)!

  const lineShift = first[2] - line
  const columnShift = first[3] - first[0]
  const shifted: Omit<RawSourceMap, 'version'> & { version: number } = {
    version: 3,
    sources: inMap.sources,
    names: map.names,
    mappings: encodeMappings(
      decodeMappings(map.mappings).map(segments =>
        segments.map(s => {
          if (s.length === 1) return s
          const shiftedSegment: SourceMapSegment = [
            s[0],
            0,
            Math.max(0, s[2] + lineShift),
            Math.max(0, s[3] + columnShift),
          ]
          if (s.length === 5) shiftedSegment.push(s[4])
          return shiftedSegment
        }),
      ),
    ),
  }
  if (inMap.file != null) shifted.file = inMap.file
  if (inMap.sourceRoot != null) shifted.sourceRoot = inMap.sourceRoot
  if (inMap.sourcesContent) shifted.sourcesContent = inMap.sourcesContent
  return shifted as unknown as RawSourceMap
}

function patchErrors(
  errors: CompilerError[],
  source: string,
  inMap: RawSourceMap,
) {
  const originalSource = inMap.sourcesContent![0]
  const offset = originalSource.indexOf(source)
  const lineOffset = originalSource.slice(0, offset).split(/\r?\n/).length - 1
  errors.forEach(err => {
    if (err.loc) {
      err.loc.start.line += lineOffset
      err.loc.start.offset += offset
      if (err.loc.end !== err.loc.start) {
        err.loc.end.line += lineOffset
        err.loc.end.offset += offset
      }
    }
  })
}
