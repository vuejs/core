import * as m from 'monaco-editor'
import * as compiler from './compiler'
import * as outputEditor from './outputEditor'
import createEditor from './createEditor'
import persistedState from './persistedState'
import debounce from './debounce'
import { getLastSuccessfulMap } from './lastSuccessfulMap'

let _codeEditor: m.editor.IStandaloneCodeEditor

// highlight output code
export let prevOutputDecos: string[] = []

export function clearOutputDecos() {
  prevOutputDecos = outputEditor
    .getEditor()
    .deltaDecorations(prevOutputDecos, [])
}

export function initEditor() {
  const monaco = window.monaco

  _codeEditor = createEditor('source', {
    value: persistedState.get().src || `<div>Hello World!</div>`,
    language: 'html'
  })

  // update compile output when input changes
  _codeEditor.onDidChangeModelContent(debounce(compiler.reCompile))

  _codeEditor.onDidChangeCursorPosition(
    debounce(e => {
      outputEditor.clearEditorDecos()
      const lastSuccessfulMap = getLastSuccessfulMap()

      if (lastSuccessfulMap) {
        const pos = lastSuccessfulMap.generatedPositionFor({
          source: 'template.vue',
          line: e.position.lineNumber,
          column: e.position.column - 1
        })
        if (pos.line != null && pos.column != null) {
          prevOutputDecos = outputEditor
            .getEditor()
            .deltaDecorations(prevOutputDecos, [
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
          outputEditor.getEditor().revealPositionInCenter({
            lineNumber: pos.line,
            column: pos.column + 1
          })
        } else {
          clearOutputDecos()
        }
      }
    }, 100)
  )
}

export function getEditor() {
  if (!_codeEditor) initEditor()

  return _codeEditor
}
