// const postcss = require('postcss')
import postcss, { ProcessOptions, LazyResult, Result, ResultMap } from 'postcss'
import trimPlugin from './stylePluginTrim'
import scopedPlugin from './stylePluginScoped'
import {
  processors,
  StylePreprocessor,
  StylePreprocessorResults
} from './stylePreprocessors'

export interface StyleCompileOptions {
  source: string
  filename: string
  id: string
  map?: object
  scoped?: boolean
  trim?: boolean
  preprocessLang?: string
  preprocessOptions?: any
  postcssOptions?: any
  postcssPlugins?: any[]
}

export interface AsyncStyleCompileOptions extends StyleCompileOptions {
  isAsync?: boolean
}

export interface StyleCompileResults {
  code: string
  map: object | void
  rawResult: LazyResult | Result | undefined
  errors: string[]
}

export function compileStyle(
  options: StyleCompileOptions
): StyleCompileResults {
  return doCompileStyle({ ...options, isAsync: false }) as StyleCompileResults
}

export function compileStyleAsync(
  options: StyleCompileOptions
): Promise<StyleCompileResults> {
  return doCompileStyle({ ...options, isAsync: true }) as Promise<
    StyleCompileResults
  >
}

export function doCompileStyle(
  options: AsyncStyleCompileOptions
): StyleCompileResults | Promise<StyleCompileResults> {
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

  const errors: any[] = []
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
          map: result.map && result.map.toJSON(),
          errors,
          rawResult: result
        }))
        .catch(error => ({
          code: '',
          map: undefined,
          errors: [...errors, error.message],
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
    map: outMap && outMap.toJSON(),
    errors,
    rawResult: result
  }
}

function preprocess(
  options: StyleCompileOptions,
  preprocessor: StylePreprocessor
): StylePreprocessorResults {
  return preprocessor.render(
    options.source,
    options.map,
    Object.assign(
      {
        filename: options.filename
      },
      options.preprocessOptions
    )
  )
}
