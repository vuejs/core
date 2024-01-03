export const version = __VERSION__

// API
export { parse } from './parse'
export { compileTemplate } from './compileTemplate'
export { compileStyle, compileStyleAsync } from './compileStyle'
export { compileScript } from './compileScript'
export { rewriteDefault, rewriteDefaultAST } from './rewriteDefault'
export { resolveTypeElements, inferRuntimeType } from './script/resolveType'

import { type SFCParseResult, parseCache as _parseCache } from './parse'
// #9521 export parseCache as a simple map to avoid exposing LRU types
export const parseCache = _parseCache as Map<string, SFCParseResult>

// error messages
import {
  DOMErrorMessages,
  errorMessages as coreErrorMessages,
} from '@vue/compiler-dom'

export const errorMessages = {
  ...coreErrorMessages,
  ...DOMErrorMessages,
}

// Utilities
export { parse as babelParse } from '@babel/parser'
import MagicString from 'magic-string'
export { MagicString }
// technically internal but we want it in @vue/repl, cast it as any to avoid
// relying on estree types
import { walk as _walk } from 'estree-walker'
export const walk = _walk as any
export {
  generateCodeFrame,
  walkIdentifiers,
  extractIdentifiers,
  isInDestructureAssignment,
  isStaticProperty,
} from '@vue/compiler-core'

// Internals for type resolution
export { invalidateTypeCache, registerTS } from './script/resolveType'
export { extractRuntimeProps } from './script/defineProps'
export { extractRuntimeEmits } from './script/defineEmits'

// Types
export type {
  SFCParseOptions,
  SFCParseResult,
  SFCDescriptor,
  SFCBlock,
  SFCTemplateBlock,
  SFCScriptBlock,
  SFCStyleBlock,
} from './parse'
export type {
  TemplateCompiler,
  SFCTemplateCompileOptions,
  SFCTemplateCompileResults,
} from './compileTemplate'
export type {
  SFCStyleCompileOptions,
  SFCAsyncStyleCompileOptions,
  SFCStyleCompileResults,
} from './compileStyle'
export type { SFCScriptCompileOptions } from './compileScript'
export type { ScriptCompileContext } from './script/context'
export type {
  TypeResolveContext,
  SimpleTypeResolveOptions,
  SimpleTypeResolveContext,
} from './script/resolveType'
export type {
  AssetURLOptions,
  AssetURLTagConfig,
} from './template/transformAssetUrl'
export type {
  CompilerOptions,
  CompilerError,
  BindingMetadata,
} from '@vue/compiler-core'

/**
 * @deprecated this is preserved to avoid breaking vite-plugin-vue < 5.0
 * with reactivityTransform: true. The desired behavior should be silently
 * ignoring the option instead of breaking.
 */
export const shouldTransformRef = () => false
