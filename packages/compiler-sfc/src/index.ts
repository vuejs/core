// API
export { parse } from './parse'
export { compileTemplate } from './compileTemplate'
export { compileStyle, compileStyleAsync } from './compileStyle'

// Types
export {
  SFCParseOptions,
  SFCDescriptor,
  SFCBlock,
  SFCTemplateBlock,
  SFCScriptBlock,
  SFCStyleBlock
} from './parse'
export {
  TemplateCompiler,
  SFCTemplateCompileOptions,
  SFCTemplateCompileResults
} from './compileTemplate'
export {
  SFCStyleCompileOptions,
  SFCAsyncStyleCompileOptions,
  SFCStyleCompileResults
} from './compileStyle'
export {
  CompilerOptions,
  CompilerError,
  generateCodeFrame
} from '@vue/compiler-core'
