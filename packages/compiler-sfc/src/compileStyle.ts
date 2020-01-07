// const postcss = require('postcss')
import postcss, { ProcessOptions, LazyResult, Result, ResultMap } from 'postcss'
import trimPlugin from './stylePluginTrim'
import scopedPlugin from './stylePluginScoped'
import {
  processors,
  StylePreprocessor,
  StylePreprocessorResults,
  PreprocessLang
} from './stylePreprocessors'
import { RawSourceMap } from 'source-map'

export interface SFCStyleCompileOptions {
  source: string
  filename: string
  id: string
  map?: RawSourceMap
  scoped?: boolean
  trim?: boolean
  preprocessLang?: PreprocessLang
  preprocessOptions?: any
  postcssOptions?: any
  postcssPlugins?: any[]
}

export interface SFCAsyncStyleCompileOptions extends SFCStyleCompileOptions {
  isAsync?: boolean
}

export interface SFCStyleCompileResults {
  code: string
  map: RawSourceMap | undefined
  rawResult: LazyResult | Result | undefined
  errors: Error[]
}

export function compileStyle(
  options: SFCStyleCompileOptions
): SFCStyleCompileResults {
  return doCompileStyle({
    ...options,
    isAsync: false
  }) as SFCStyleCompileResults
}

export function compileStyleAsync(
  options: SFCStyleCompileOptions
): Promise<SFCStyleCompileResults> {
  return doCompileStyle({ ...options, isAsync: true }) as Promise<
    SFCStyleCompileResults
  >
}

export function doCompileStyle(
  options: SFCAsyncStyleCompileOptions
): SFCStyleCompileResults | Promise<SFCStyleCompileResults> {
  const {
    filename,
    id,
    scoped = true,
    trim = true,
    preprocessLang,
    postcssOptions,
    postcssPlugins
  } = options
  const preprocessor = preprocessLang && processors[preprocessLang]
  const preProcessedSource = preprocessor && preprocess(options, preprocessor)
  const map = preProcessedSource ? preProcessedSource.map : options.map
  const source = preProcessedSource ? preProcessedSource.code : options.source

  const plugins = (postcssPlugins || []).slice()
  if (trim) {
    plugins.push(trimPlugin())
  }
  if (scoped) {
    plugins.push(scopedPlugin(id))
  }

  const postCSSOptions: ProcessOptions = {
    ...postcssOptions,
    to: filename,
    from: filename
  }
  if (map) {
    postCSSOptions.map = {
      inline: false,
      annotation: false,
      prev: map
    }
  }

  let result: LazyResult | undefined
  let code: string | undefined
  let outMap: ResultMap | undefined

  const errors: Error[] = []
  if (preProcessedSource && preProcessedSource.errors.length) {
    errors.push(...preProcessedSource.errors)
  }

  try {
    result = postcss(plugins).process(source, postCSSOptions)

    // In async mode, return a promise.
    if (options.isAsync) {
      return result
        .then(result => ({
          code: result.css || '',
          map: result.map && (result.map.toJSON() as any),
          errors,
          rawResult: result
        }))
        .catch(error => ({
          code: '',
          map: undefined,
          errors: [...errors, error],
          rawResult: undefined
        }))
    }

    // force synchronous transform (we know we only have sync plugins)
    code = result.css
    outMap = result.map
  } catch (e) {
    errors.push(e)
  }

  return {
    code: code || ``,
    map: outMap && (outMap.toJSON() as any),
    errors,
    rawResult: result
  }
}

function preprocess(
  options: SFCStyleCompileOptions,
  preprocessor: StylePreprocessor
): StylePreprocessorResults {
  return preprocessor.render(options.source, options.map, {
    filename: options.filename,
    ...options.preprocessOptions
  })
}
