import * as m from 'monaco-editor'
import * as codeEditor from './codeEditor'
import createEditor from './createEditor'
import debounce from './debounce'
import { getLastSuccessfulMap } from './lastSuccessfulMap'

let _outputEditor: m.editor.IStandaloneCodeEditor

export let previousEditorDecos: string[] = []
export function clearEditorDecos() {
  previousEditorDecos = codeEditor
    .getEditor()
    .deltaDecorations(previousEditorDecos, [])
}

export function initEditor() {
  const monaco = window.monaco

  _outputEditor = createEditor('output', {
    value: '',
    language: 'javascript',
    readOnly: true
  })

  _outputEditor.onDidChangeCursorPosition(
    debounce(e => {
      codeEditor.clearOutputDecos()
      const lastSuccessfulMap = getLastSuccessfulMap()

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
          previousEditorDecos = codeEditor
            .getEditor()
            .deltaDecorations(previousEditorDecos, [
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
          codeEditor.getEditor().revealPositionInCenter(translatedPos)
        } else {
          clearEditorDecos()
        }
      }
    }, 100)
  )
}

export function getEditor() {
  if (!_outputEditor) initEditor()

  return _outputEditor
}
