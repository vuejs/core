import * as m from 'monaco-editor'
import { compile } from '@vue/compiler-dom'

const self = window as any

self.init = () => {
  const monaco = (window as any).monaco as typeof m
  const persistedContent =
    decodeURIComponent(window.location.hash.slice(1)) ||
    `<div>{{ foo + bar }}</div>`

  self.compilerOptions = {
    mode: 'module',
    prefixIdentifiers: true,
    hoistStatic: true
  }

  function compileCode(source: string): string {
    console.clear()
    try {
      const { code, ast } = compile(source, self.compilerOptions)

      console.log(ast)
      return code
    } catch (e) {
      console.error(e)
      return `/* See console for error */`
    }
  }

  const sharedOptions = {
    theme: 'vs-dark',
    fontSize: 14,
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    minimap: {
      enabled: false
    }
  } as const

  const editor = monaco.editor.create(
    document.getElementById('source') as HTMLElement,
    {
      value: persistedContent,
      language: 'html',
      ...sharedOptions
    }
  )

  const model = editor.getModel()!

  model.updateOptions({
    tabSize: 2
  })

  model.onDidChangeContent(() => {
    const src = editor.getValue()
    window.location.hash = encodeURIComponent(src)
    const res = compileCode(src)
    if (res) {
      output.setValue(res)
    }
  })

  const output = monaco.editor.create(
    document.getElementById('output') as HTMLElement,
    {
      value: compileCode(persistedContent),
      language: 'javascript',
      readOnly: true,
      ...sharedOptions
    }
  )

  output.getModel()!.updateOptions({
    tabSize: 2
  })

  window.addEventListener('resize', () => {
    editor.layout()
    output.layout()
  })
}
