import {
  CompilerOptions,
  CodegenResult,
  CompilerError,
  NodeTransform
} from '@vue/compiler-core'
import { RawSourceMap } from 'source-map'
import {
  transformAssetUrl,
  AssetURLOptions,
  createAssetUrlTransformWithOptions
} from './templateTransformAssetUrl'
import { transformSrcset } from './templateTransformSrcset'
import { isObject } from '@vue/shared'
import consolidate from 'consolidate'

export interface TemplateCompileResults {
  code: string
  source: string
  tips: string[]
  errors: (string | CompilerError)[]
  map?: RawSourceMap
}

export interface TemplateCompiler {
  compile(template: string, options: CompilerOptions): CodegenResult
}

export interface TemplateCompileOptions {
  source: string
  filename: string
  compiler?: TemplateCompiler
  compilerOptions?: CompilerOptions
  preprocessLang?: string
  preprocessOptions?: any
  transformAssetUrls?: AssetURLOptions | boolean
}

function preprocess(
  { source, filename, preprocessOptions }: TemplateCompileOptions,
  preprocessor: any
): string {
  // Consolidate exposes a callback based API, but the callback is in fact
  // called synchronously for most templating engines. In our case, we have to
  // expose a synchronous API so that it is usable in Jest transforms (which
  // have to be sync because they are applied via Node.js require hooks)
  let res: any, err
  preprocessor.render(
    source,
    { filename, ...preprocessOptions },
    (_err: Error | null, _res: string) => {
      if (_err) err = _err
      res = _res
    }
  )

  if (err) throw err
  return res
}

export function compileTemplate(
  options: TemplateCompileOptions
): TemplateCompileResults {
  const { preprocessLang } = options
  const preprocessor =
    preprocessLang && consolidate[preprocessLang as keyof typeof consolidate]
  if (preprocessor) {
    try {
      return doCompileTemplate({
        ...options,
        source: preprocess(options, preprocessor)
      })
    } catch (e) {
      return {
        code: `export default function render() {}`,
        source: options.source,
        tips: [],
        errors: [e]
      }
    }
  } else if (preprocessLang) {
    return {
      code: `export default function render() {}`,
      source: options.source,
      tips: [
        `Component ${
          options.filename
        } uses lang ${preprocessLang} for template. Please install the language preprocessor.`
      ],
      errors: [
        `Component ${
          options.filename
        } uses lang ${preprocessLang} for template, however it is not installed.`
      ]
    }
  } else {
    return doCompileTemplate(options)
  }
}

function doCompileTemplate({
  filename,
  source,
  compiler = require('@vue/compiler-dom'),
  compilerOptions = {},
  transformAssetUrls
}: TemplateCompileOptions): TemplateCompileResults {
  const errors: CompilerError[] = []

  let nodeTransforms: NodeTransform[] = []
  if (isObject(transformAssetUrls)) {
    nodeTransforms = [
      createAssetUrlTransformWithOptions(transformAssetUrls),
      transformSrcset
    ]
  } else if (transformAssetUrls !== false) {
    nodeTransforms = [transformAssetUrl, transformSrcset]
  }

  const { code, map } = compiler.compile(source, {
    mode: 'module',
    prefixIdentifiers: true,
    hoistStatic: true,
    cacheHandlers: true,
    ...compilerOptions,
    nodeTransforms: nodeTransforms.concat(compilerOptions.nodeTransforms || []),
    filename,
    sourceMap: true,
    onError: e => errors.push(e)
  })
  return { code, source, errors, tips: [], map }
}
