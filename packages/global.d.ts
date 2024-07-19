/// <reference types="vite/client" />

// Global compile-time constants
declare var __DEV__: boolean
declare var __TEST__: boolean
declare var __BROWSER__: boolean
declare var __GLOBAL__: boolean
declare var __ESM_BUNDLER__: boolean
declare var __ESM_BROWSER__: boolean
declare var __CJS__: boolean
declare var __SSR__: boolean
declare var __COMMIT__: string
declare var __VERSION__: string
declare var __COMPAT__: boolean

// Feature flags
declare var __FEATURE_OPTIONS_API__: boolean
declare var __FEATURE_PROD_DEVTOOLS__: boolean
declare var __FEATURE_SUSPENSE__: boolean
declare var __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: boolean

declare module '*.vue' {}

declare module 'file-saver' {
  export function saveAs(blob: any, name: any): void
}

declare module 'estree-walker' {
  export function walk<T>(
    root: T,
    options: {
      enter?: (node: T, parent: T | null) => any
      leave?: (node: T, parent: T | null) => any
      exit?: (node: T) => any
    } & ThisType<{ skip: () => void }>,
  )
}

declare interface String {
  /**
   * @deprecated Please use String.prototype.slice instead of String.prototype.substring in the repository.
   */
  substring(start: number, end?: number): string
}
