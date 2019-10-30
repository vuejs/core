import { CompilerError } from '@vue/compiler-dom'

export default function formatCompilerError(err: CompilerError) {
  const loc = err.loc!
  const monaco = window.monaco

  return {
    severity: monaco.MarkerSeverity.Error,
    startLineNumber: loc.start.line,
    startColumn: loc.start.column,
    endLineNumber: loc.end.line,
    endColumn: loc.end.column,
    message: `Vue template compilation error: ${err.message}`,
    code: String(err.code)
  }
}
