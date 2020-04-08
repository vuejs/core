import { ElementNode, Namespace, JSChildNode, PlainElementNode } from './ast'
import { TextModes } from './parse'
import { CompilerError } from './errors'
import {
  NodeTransform,
  DirectiveTransform,
  TransformContext
} from './transform'
import { ParserPlugin } from '@babel/parser'

export interface ParserOptions {
  // e.g. platform native elements, e.g. <div> for browsers
  isNativeTag?: (tag: string) => boolean
  // e.g. native elements that can self-close, e.g. <img>, <br>, <hr>
  isVoidTag?: (tag: string) => boolean
  // e.g. elements that should preserve whitespace inside, e.g. <pre>
  isPreTag?: (tag: string) => boolean
  // platform-specific built-in components e.g. <Transition>
  isBuiltInComponent?: (tag: string) => symbol | void
  // separate option for end users to extend the native elements list
  isCustomElement?: (tag: string) => boolean
  getNamespace?: (tag: string, parent: ElementNode | undefined) => Namespace
  getTextMode?: (
    tag: string,
    ns: Namespace,
    parent: ElementNode | undefined
  ) => TextModes
  delimiters?: [string, string] // ['{{', '}}']
  decodeEntities?: (rawText: string, asAttr: boolean) => string
  onError?: (error: CompilerError) => void
}

export type HoistTransform = (
  node: PlainElementNode,
  context: TransformContext
) => JSChildNode

export interface TransformOptions {
  nodeTransforms?: NodeTransform[]
  directiveTransforms?: Record<string, DirectiveTransform | undefined>
  // an optional hook to transform a node being hoisted.
  // used by compiler-dom to turn hoisted nodes into stringified HTML vnodes.
  transformHoist?: HoistTransform | null
  isBuiltInComponent?: (tag: string) => symbol | void
  // Transform expressions like {{ foo }} to `_ctx.foo`.
  // If this option is false, the generated code will be wrapped in a
  // `with (this) { ... }` block.
  // - This is force-enabled in module mode, since modules are by default strict
  //   and cannot use `with`
  // - Default: mode === 'module'
  prefixIdentifiers?: boolean
  // Hoist static VNodes and props objects to `_hoisted_x` constants
  // - Default: false
  hoistStatic?: boolean
  // Cache v-on handlers to avoid creating new inline functions on each render,
  // also avoids the need for dynamically patching the handlers by wrapping it.
  // e.g `@click="foo"` by default is compiled to `{ onClick: foo }`. With this
  // option it's compiled to:
  // `{ onClick: _cache[0] || (_cache[0] = e => _ctx.foo(e)) }`
  // - Requires "prefixIdentifiers" to be enabled because it relies on scope
  //   analysis to determine if a handler is safe to cache.
  // - Default: false
  cacheHandlers?: boolean
  // a list of parser plugins to enable for @babel/parser
  // https://babeljs.io/docs/en/next/babel-parser#plugins
  expressionPlugins?: ParserPlugin[]
  // SFC scoped styles ID
  scopeId?: string | null
  ssr?: boolean
  onError?: (error: CompilerError) => void
}

export interface CodegenOptions {
  // - Module mode will generate ES module import statements for helpers
  //   and export the render function as the default export.
  // - Function mode will generate a single `const { helpers... } = Vue`
  //   statement and return the render function. It is meant to be used with
  //   `new Function(code)()` to generate a render function at runtime.
  // - Default: 'function'
  mode?: 'module' | 'function'
  // Generate source map?
  // - Default: false
  sourceMap?: boolean
  // Filename for source map generation.
  // - Default: `template.vue.html`
  filename?: string
  // SFC scoped styles ID
  scopeId?: string | null
  // we need to know about this to generate proper preambles
  prefixIdentifiers?: boolean
  // option to optimize helper import bindings via variable assignment
  // (only used for webpack code-split)
  optimizeBindings?: boolean
  // for specifying where to import helpers
  runtimeModuleName?: string
  runtimeGlobalName?: string
  // generate ssr-specific code?
  ssr?: boolean
}

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions
