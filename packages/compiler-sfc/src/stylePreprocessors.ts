import merge from 'merge-source-map'

export interface StylePreprocessor {
  render(
    source: string,
    map?: object,
    options?: any,
    customRequire?: (id: string) => any
  ): StylePreprocessorResults
}

export interface StylePreprocessorResults {
  code: string
  map?: object
  errors: Error[]
}

// .scss/.sass processor
const scss: StylePreprocessor = {
  render(source, map, options, load = require) {
    const nodeSass = load('sass')
    const finalOptions = {
      ...options,
      data: source,
      file: options.filename,
      outFile: options.filename,
      sourceMap: !!map
    }

    try {
      const result = nodeSass.renderSync(finalOptions)

      if (map) {
        return {
          code: result.css.toString(),
          map: merge(map, JSON.parse(result.map.toString())),
          errors: []
        }
      }

      return { code: result.css.toString(), errors: [] }
    } catch (e) {
      return { code: '', errors: [e] }
    }
  }
}

const sass: StylePreprocessor = {
  render(source, map, options, load) {
    return scss.render(
      source,
      map,
      {
        ...options,
        indentedSyntax: true
      },
      load
    )
  }
}

// .less
const less: StylePreprocessor = {
  render(source, map, options, load = require) {
    const nodeLess = load('less')

    let result: any
    let error: Error | null = null
    nodeLess.render(
      source,
      { ...options, syncImport: true },
      (err: Error | null, output: any) => {
        error = err
        result = output
      }
    )

    if (error) return { code: '', errors: [error] }

    if (map) {
      return {
        code: result.css.toString(),
        map: merge(map, result.map),
        errors: []
      }
    }

    return { code: result.css.toString(), errors: [] }
  }
}

// .styl
const styl: StylePreprocessor = {
  render(source, map, options, load = require) {
    const nodeStylus = load('stylus')
    try {
      const ref = nodeStylus(source)
      Object.keys(options).forEach(key => ref.set(key, options[key]))
      if (map) ref.set('sourcemap', { inline: false, comment: false })

      const result = ref.render()
      if (map) {
        return {
          code: result,
          map: merge(map, ref.sourcemap),
          errors: []
        }
      }

      return { code: result, errors: [] }
    } catch (e) {
      return { code: '', errors: [e] }
    }
  }
}

export type PreprocessLang = 'less' | 'sass' | 'scss' | 'styl' | 'stylus'

export const processors: Record<PreprocessLang, StylePreprocessor> = {
  less,
  sass,
  scss,
  styl,
  stylus: styl
}
