import * as m from 'monaco-editor'
import { compile, CompilerError } from '@vue/compiler-dom'
import { compilerOptions, initOptions } from './options'
import { watch } from '@vue/runtime-dom'
import { SourceMapConsumer } from 'source-map'

const self = window as any

self.init = () => {
  const monaco = (window as any).monaco as typeof m
  const persistedState = JSON.parse(
    decodeURIComponent(window.location.hash.slice(1)) || `{}`
  )

  Object.assign(compilerOptions, persistedState.options)

  let lastSuccessfulCode: string = `/* See console for error */`
  let lastSuccessfulMap: SourceMapConsumer | undefined = undefined
  function compileCode(source: string): string {
    console.clear()
    try {
      const { code, ast, map } = compile(source, {
        filename: 'template.vue',
        ...compilerOptions,
        sourceMap: true,
        onError: displayError
      })
      monaco.editor.setModelMarkers(editor.getModel()!, `@vue/compiler-dom`, [])
      console.log(`AST: `, ast)
      lastSuccessfulCode = code + `\n\n// Check the console for the AST`
      lastSuccessfulMap = new self._deps['source-map'].SourceMapConsumer(
        map
      ) as SourceMapConsumer
      lastSuccessfulMap.computeColumnSpans()
    } catch (e) {
      console.error(e)
    }
    return lastSuccessfulCode
  }

  function displayError(err: CompilerError) {
    const loc = err.loc
    if (loc) {
      monaco.editor.setModelMarkers(editor.getModel()!, `@vue/compiler-dom`, [
        {
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: loc.start.line,
          startColumn: loc.start.column,
          endLineNumber: loc.end.line,
          endColumn: loc.end.column,
          message: `Vue template compilation error: ${err.message}`,
          code: String(err.code)
        }
      ])
    }
    throw err
  }

  function reCompile() {
    const src = editor.getValue()
    // every time we re-compile, persist current state to URL
    window.location.hash = encodeURIComponent(
      JSON.stringify({
        src,
        options: compilerOptions
      })
    )
    const res = compileCode(src)
    if (res) {
      output.setValue(res)
    }
  }

  const sharedEditorOptions = {
    theme: 'vs-dark',
    fontSize: 14,
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    renderWhitespace: 'selection',
    contextmenu: false,
    minimap: {
      enabled: false
    }
  } as const

  const editor = monaco.editor.create(
    document.getElementById('source') as HTMLElement,
    {
      value: persistedState.src || `<div>Hello World!</div>`,
      language: 'html',
      ...sharedEditorOptions
    }
  )

  editor.getModel()!.updateOptions({
    tabSize: 2
  })

  const output = monaco.editor.create(
    document.getElementById('output') as HTMLElement,
    {
      value: '',
      language: 'javascript',
      readOnly: true,
      ...sharedEditorOptions
    }
  )
  output.getModel()!.updateOptions({
    tabSize: 2
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
        const pos = lastSuccessfulMap.generatedPositionFor({
          source: 'template.vue',
          line: e.position.lineNumber,
          column: e.position.column - 1
        })
        if (pos.line != null && pos.column != null) {
          prevOutputDecos = output.deltaDecorations(prevOutputDecos, [
            {
              range: new monaco.Range(
                pos.line,
                pos.column + 1,
                pos.line,
                pos.lastColumn ? pos.lastColumn + 2 : pos.column + 2
              ),
              options: {
                inlineClassName: `highlight`
              }
            }
          ])
          output.revealPositionInCenter({
            lineNumber: pos.line,
            column: pos.column + 1
          })
        } else {
          clearOutputDecos()
        }
      }
    }, 100)
  )

  let previousEditorDecos: string[] = []
  function clearEditorDecos() {
    previousEditorDecos = editor.deltaDecorations(previousEditorDecos, [])
  }

  output.onDidChangeCursorPosition(
    debounce(e => {
      clearOutputDecos()
      if (lastSuccessfulMap) {
        const pos = lastSuccessfulMap.originalPositionFor({
          line: e.position.lineNumber,
          column: e.position.column - 1
        })
        if (
          pos.line != null &&
          pos.column != null &&
          !// ignore mock location
          (pos.line === 1 && pos.column === 0)
        ) {
          const translatedPos = {
            column: pos.column + 1,
            lineNumber: pos.line
          }
          previousEditorDecos = editor.deltaDecorations(previousEditorDecos, [
            {
              range: new monaco.Range(
                pos.line,
                pos.column + 1,
                pos.line,
                pos.column + 1
              ),
              options: {
                isWholeLine: true,
                className: `highlight`
              }
            }
          ])
          editor.revealPositionInCenter(translatedPos)
        } else {
          clearEditorDecos()
        }
      }
    }, 100)
  )

  initOptions()
  watch(reCompile)
}

function debounce<T extends Function>(fn: T, delay: number = 300): T {
  let prevTimer: NodeJS.Timeout | null = null
  return ((...args: any[]) => {
    if (prevTimer) {
      clearTimeout(prevTimer)
    }
    prevTimer = setTimeout(() => {
      fn(...args)
      prevTimer = null
    }, delay)
  }) as any
}
