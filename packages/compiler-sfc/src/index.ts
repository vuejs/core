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
  TemplateCompileOptions,
  TemplateCompileResults
} from './compileTemplate'
export { StyleCompileOptions, StyleCompileResults } from './compileStyle'
export { CompilerOptions, generateCodeFrame } from '@vue/compiler-core'
