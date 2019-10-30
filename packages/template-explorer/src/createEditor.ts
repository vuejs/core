import * as m from 'monaco-editor'

const sharedEditorOptions: m.editor.IEditorConstructionOptions = {
  theme: 'vs-dark',
  fontSize: 14,
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  renderWhitespace: 'selection',
  contextmenu: false,
  minimap: {
    enabled: false
  }
}

export default function createEditor(
  elementId: string,
  options: m.editor.IEditorConstructionOptions
): m.editor.IStandaloneCodeEditor {
  const editor = window.monaco.editor.create(
    document.getElementById(elementId)!,
    {
      ...options,
      ...sharedEditorOptions
    }
  )

  editor.getModel()!.updateOptions({
    tabSize: 2
  })

  return editor
}
