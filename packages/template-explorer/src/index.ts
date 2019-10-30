import * as m from 'monaco-editor'
import { watch } from '@vue/runtime-dom'
import * as compiler from './compiler'
import { initOptions } from './options'
import * as codeEditor from './codeEditor'
import * as outputEditor from './outputEditor'

declare global {
  interface Window {
    monaco: typeof m
    _deps: any
    init: () => void
  }
}

window.init = () => {
  codeEditor.initEditor()
  outputEditor.initEditor()

  // handle resize
  window.addEventListener('resize', () => {
    codeEditor.getEditor().layout()
    outputEditor.getEditor().layout()
  })

  initOptions()
  watch(compiler.reCompile)
}
