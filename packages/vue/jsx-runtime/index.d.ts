import { VNode, VNodeRef } from '@vue/runtime-dom'
import { IntrinsicElementAttributes } from './dom'

export type ReservedProps = {
  key?: string | number | symbol
  ref?: VNodeRef
  ref_for?: boolean
  ref_key?: string
}

export type NativeElements = {
  [K in keyof IntrinsicElementAttributes]: IntrinsicElementAttributes[K] &
    ReservedProps
}

/**
 * JSX namespace for usage with @jsxImportsSource directive
 * when ts compilerOptions.jsx is 'react-jsx' or 'react-jsxdev'
 * https://www.typescriptlang.org/tsconfig#jsxImportSource
 */
export { h as jsx, h as jsxDEV, Fragment } from '@vue/runtime-dom'

export namespace JSX {
  export interface Element extends VNode {}
  export interface ElementClass {
    $props: {}
  }
  export interface ElementAttributesProperty {
    $props: {}
  }
  export interface IntrinsicElements extends NativeElements {
    // allow arbitrary elements
    // @ts-ignore suppress ts:2374 = Duplicate string index signature.
    [name: string]: any
  }
  export interface IntrinsicAttributes extends ReservedProps {}
  export interface ElementChildrenAttribute {
    $slots: {}
  }
}
