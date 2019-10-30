import { compile, CompilerError } from '@vue/compiler-dom'
import formatCompilerError from './formatCompilerError'
import persistedState from './persistedState'
import { setLastSuccessfulMap, getLastSuccessfulMap } from './lastSuccessfulMap'
import { compilerOptions } from './options'
import * as codeEditor from './codeEditor'
import * as outputEditor from './outputEditor'

let lastSuccessfulCode: string = `/* See console for error */`

export function compileCode(source: string): string {
  const monaco = window.monaco

  console.clear()
  try {
    const errors: CompilerError[] = []
    const { code, ast, map } = compile(source, {
      filename: 'template.vue',
      ...compilerOptions,
      sourceMap: true,
      onError: err => {
        errors.push(err)
      }
    })
    monaco.editor.setModelMarkers(
      codeEditor.getEditor().getModel()!,
      `@vue/compiler-dom`,
      errors.filter(e => e.loc).map(formatCompilerError)
    )
    console.log(`AST: `, ast)
    lastSuccessfulCode = code + `\n\n// Check the console for the AST`
    setLastSuccessfulMap(new window._deps['source-map'].SourceMapConsumer(map))
    getLastSuccessfulMap()!.computeColumnSpans()
  } catch (e) {
    console.error(e)
  }
  return lastSuccessfulCode
}

export function reCompile() {
  const src: string = codeEditor.getEditor().getValue()

  // every time we re-compile, persist current state
  persistedState.set({
    src,
    options: compilerOptions
  })

  const res = compileCode(src)
  if (res) {
    outputEditor.getEditor().setValue(res)
  }
}
