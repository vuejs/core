/// <reference types="vite/client" />

// Global compile-time constants
declare var __DEV__: boolean
declare var __TEST__: boolean
declare var __BROWSER__: boolean
declare var __GLOBAL__: boolean
declare var __ESM_BUNDLER__: boolean
declare var __ESM_BROWSER__: boolean
declare var __NODE_JS__: boolean
declare var __SSR__: boolean
declare var __COMMIT__: string
declare var __VERSION__: string
declare var __COMPAT__: boolean

// Feature flags
declare var __FEATURE_OPTIONS_API__: boolean
declare var __FEATURE_PROD_DEVTOOLS__: boolean
declare var __FEATURE_SUSPENSE__: boolean

// for tests
declare namespace jest {
  interface Matchers<R, T> {
    toHaveBeenWarned(): R
    toHaveBeenWarnedLast(): R
    toHaveBeenWarnedTimes(n: number): R
  }
}

declare module '*.vue' {}

declare module 'file-saver' {
  export function saveAs(blob: any, name: any): void
}

declare module 'stream/web' {
  const r: typeof ReadableStream
  const t: typeof TransformStream
  export { r as ReadableStream, t as TransformStream }
}

declare module '@vue/repl' {
  import { ComponentOptions } from '@vue/runtime-core'
  const Repl: ComponentOptions
  const ReplStore: any
  export { Repl, ReplStore }
}

// for String
declare interface String {
  /**
   * Returns the substring at the specified location within a String object.
   * @deprecated Please use String.prototype.slice instead of String.prototype.substring in the repository.
   * @see https://github.com/vuejs/vue-next/pull/4699.
   * @param start The zero-based index number indicating the beginning of the substring.
   * @param end Zero-based index number indicating the end of the substring. The substring includes the characters up to, but not including, the character indicated by end.
   * If end is omitted, the characters from start through the end of the original string are returned.
   */
  substring(start: number, end?: number): string;
}
