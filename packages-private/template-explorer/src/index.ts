import type * as m from 'monaco-editor'
import type { CompilerError } from '@vue/compiler-dom'
import { compile } from '@vue/compiler-dom'
import {
  type CompilerOptions,
  compile as vaporCompile,
} from '@vue/compiler-vapor'
// import { compile as ssrCompile } from '@vue/compiler-ssr'

import {
  compilerOptions,
  defaultOptions,
  initOptions,
  ssrMode,
  vaporMode,
} from './options'
import { toRaw, watchEffect } from '@vue/runtime-dom'
import { type SourceMapSegment, decodeMappings } from 'muggle-string'
import theme from './theme'

declare global {
  interface Window {
    monaco: typeof m
    _deps: any
    init: () => void
  }
}

interface PersistedState {
  src: string
  ssr: boolean
  options: CompilerOptions
}

const sharedEditorOptions: m.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 14,
  scrollBeyondLastLine: false,
  renderWhitespace: 'selection',
  minimap: {
    enabled: false,
  },
}

window.init = () => {
  const monaco = window.monaco

  monaco.editor.defineTheme('my-theme', theme)
  monaco.editor.setTheme('my-theme')

  let persistedState: PersistedState | undefined

  try {
    let hash = window.location.hash.slice(1)
    try {
      hash = escape(atob(hash))
    } catch (e) {}
    persistedState = JSON.parse(
      decodeURIComponent(hash) || localStorage.getItem('state') || `{}`,
    )
  } catch (e: any) {
    // bad stored state, clear it
    console.warn(
      'Persisted state in localStorage seems to be corrupted, please reload.\n' +
        e.message,
    )
    localStorage.clear()
  }

  if (persistedState) {
    // functions are not persistable, so delete it in case we sometimes need
    // to debug with custom nodeTransforms
    delete persistedState.options?.nodeTransforms
    ssrMode.value = persistedState.ssr
    Object.assign(compilerOptions, persistedState.options)
  }

  let lastSuccessfulCode: string
  let lastSuccessfulMap: SourceMapSegment[][] | undefined = undefined
  let templateSource = -1
  function compileCode(source: string): string {
    console.clear()
    try {
      const errors: CompilerError[] = []
      const compileFn = /* ssrMode.value ? ssrCompile : */ (
        vaporMode.value ? vaporCompile : compile
      ) as typeof vaporCompile
      const start = performance.now()
      const { code, ast, map } = compileFn(source, {
        ...compilerOptions,
        prefixIdentifiers:
          compilerOptions.prefixIdentifiers ||
          compilerOptions.mode === 'module' ||
          compilerOptions.ssr,
        filename: 'ExampleTemplate.vue',
        sourceMap: true,
        onError: err => {
          errors.push(err)
        },
      })
      console.log(`Compiled in ${(performance.now() - start).toFixed(2)}ms.`)
      monaco.editor.setModelMarkers(
        editor.getModel()!,
        `@vue/compiler-dom`,
        errors.filter(e => e.loc).map(formatError),
      )
      console.log(`AST: `, ast)
      console.log(`Options: `, toRaw(compilerOptions))
      lastSuccessfulCode = code + `\n\n// Check the console for the AST`
      lastSuccessfulMap = decodeMappings(map!.mappings)
      templateSource = map!.sources.indexOf('ExampleTemplate.vue')
    } catch (e: any) {
      lastSuccessfulCode = `/* ERROR: ${e.message} (see console for more info) */`
      console.error(e)
    }
    return lastSuccessfulCode
  }

  function formatError(err: CompilerError) {
    const loc = err.loc!
    return {
      severity: monaco.MarkerSeverity.Error,
      startLineNumber: loc.start.line,
      startColumn: loc.start.column,
      endLineNumber: loc.end.line,
      endColumn: loc.end.column,
      message: `Vue template compilation error: ${err.message}`,
      code: String(err.code),
    }
  }

  function reCompile() {
    const src = editor.getValue()
    // every time we re-compile, persist current state

    const optionsToSave = {}
    let key: keyof CompilerOptions
    for (key in compilerOptions) {
      const val = compilerOptions[key]
      if (typeof val !== 'object' && val !== defaultOptions[key]) {
        // @ts-expect-error
        optionsToSave[key] = val
      }
    }

    const state = JSON.stringify({
      src,
      ssr: ssrMode.value,
      options: optionsToSave,
    } as PersistedState)
    localStorage.setItem('state', state)
    window.location.hash = btoa(unescape(encodeURIComponent(state)))
    const res = compileCode(src)
    if (res) {
      output.setValue(res)
    }
  }

  const editor = monaco.editor.create(document.getElementById('source')!, {
    value: persistedState?.src || `<div>Hello World</div>`,
    language: 'html',
    ...sharedEditorOptions,
    wordWrap: 'bounded',
  })

  editor.getModel()!.updateOptions({
    tabSize: 2,
  })

  const output = monaco.editor.create(document.getElementById('output')!, {
    value: '',
    language: 'javascript',
    readOnly: true,
    ...sharedEditorOptions,
  })
  output.getModel()!.updateOptions({
    tabSize: 2,
  })

  // handle resize
  window.addEventListener('resize', () => {
    editor.layout()
    output.layout()
  })

  // update compile output when input changes
  editor.onDidChangeModelContent(debounce(reCompile))

  // highlight output code
  let prevOutputDecos: string[] = []
  function clearOutputDecos() {
    prevOutputDecos = output.deltaDecorations(prevOutputDecos, [])
  }

  editor.onDidChangeCursorPosition(
    debounce(e => {
      clearEditorDecos()
      if (lastSuccessfulMap) {
        const pos = generatedSpanFor(
          lastSuccessfulMap,
          templateSource,
          e.position.lineNumber,
          e.position.column - 1,
        )
        if (pos) {
          prevOutputDecos = output.deltaDecorations(prevOutputDecos, [
            {
              range: new monaco.Range(
                pos.line,
                pos.column + 1,
                pos.line,
                pos.end + 1,
              ),
              options: {
                inlineClassName: `highlight`,
              },
            },
          ])
          output.revealPositionInCenter({
            lineNumber: pos.line,
            column: pos.column + 1,
          })
        } else {
          clearOutputDecos()
        }
      }
    }, 100),
  )

  let previousEditorDecos: string[] = []
  function clearEditorDecos() {
    previousEditorDecos = editor.deltaDecorations(previousEditorDecos, [])
  }

  output.onDidChangeCursorPosition(
    debounce(e => {
      clearOutputDecos()
      if (lastSuccessfulMap) {
        const pos = originalPositionFor(
          lastSuccessfulMap,
          e.position.lineNumber,
          e.position.column - 1,
        )
        if (
          pos &&
          !(
            // ignore mock location
            pos.line === 1 && pos.column === 0
          )
        ) {
          const translatedPos = {
            column: pos.column + 1,
            lineNumber: pos.line,
          }
          previousEditorDecos = editor.deltaDecorations(previousEditorDecos, [
            {
              range: new monaco.Range(
                pos.line,
                pos.column + 1,
                pos.line,
                pos.column + 1,
              ),
              options: {
                isWholeLine: true,
                className: `highlight`,
              },
            },
          ])
          editor.revealPositionInCenter(translatedPos)
        } else {
          clearEditorDecos()
        }
      }
    }, 100),
  )

  initOptions()
  watchEffect(reCompile)
}

function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300,
): T {
  let prevTimer: number | null = null
  return ((...args: any[]) => {
    if (prevTimer) {
      clearTimeout(prevTimer)
    }
    prevTimer = window.setTimeout(() => {
      fn(...args)
      prevTimer = null
    }, delay)
  }) as T
}

// the output of the mapping of `source` on `line` (from 1) that starts last at
// or before `column`, the earliest in the output if several; it spans up to
// the next mapping on its line
function generatedSpanFor(
  mappings: SourceMapSegment[][],
  source: number,
  line: number,
  column: number,
): { line: number; column: number; end: number } | undefined {
  let span: { line: number; column: number; end: number } | undefined
  let spanColumn = -1
  mappings.forEach((segments, generatedLine) => {
    segments.forEach(([start, segmentSource, sourceLine, sourceColumn], i) => {
      if (
        sourceColumn !== undefined &&
        segmentSource === source &&
        sourceLine === line - 1 &&
        sourceColumn <= column &&
        sourceColumn > spanColumn
      ) {
        spanColumn = sourceColumn
        const next = segments[i + 1]
        span = {
          line: generatedLine + 1,
          column: start,
          end: next ? next[0] : Infinity,
        }
      }
    })
  })
  return span
}

// the source position of the mapping on `line` (from 1) of the output that
// starts last at or before `column`
function originalPositionFor(
  mappings: SourceMapSegment[][],
  line: number,
  column: number,
): { line: number; column: number } | undefined {
  let found: SourceMapSegment | undefined
  for (const segment of mappings[line - 1] || []) {
    if (segment[0] > column) break
    if (!found || segment[0] > found[0]) found = segment
  }
  if (!found) return
  const [, , sourceLine, sourceColumn] = found
  return sourceLine === undefined || sourceColumn === undefined
    ? undefined
    : { line: sourceLine + 1, column: sourceColumn }
}
