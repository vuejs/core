import type {
  NativeElements,
  RenderResultExtensions,
  ReservedProps,
  VNode,
} from '@vue/runtime-dom'
import type { Block } from '@vue/runtime-vapor'

/**
 * JSX namespace for usage with @jsxImportsSource directive
 * when ts compilerOptions.jsx is 'react-jsx' or 'react-jsxdev'
 * https://www.typescriptlang.org/tsconfig#jsxImportSource
 */
export { h as jsx, h as jsxDEV, Fragment, h as jsxs } from '@vue/runtime-dom'

export namespace JSX {
  export type Element =
    | VNode
    | RenderResultExtensions[keyof RenderResultExtensions]
  export interface ElementClass {
    $props: {}
  }
  export interface ElementAttributesProperty {
    $props: {}
  }
  export interface IntrinsicElements extends NativeElements {
    // allow arbitrary elements
    // oxlint-disable-next-line typescript/prefer-ts-expect-error
    // @ts-ignore suppress ts:2374 = Duplicate string index signature.
    [name: string]: any
  }
  export interface IntrinsicAttributes extends ReservedProps {}
}
