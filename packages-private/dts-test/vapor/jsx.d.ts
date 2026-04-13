import type { NativeElements, ReservedProps, VaporRenderResult } from 'vue'

declare global {
  namespace JSX {
    export type Element = VaporRenderResult
    export interface ElementClass {
      $props: {}
    }
    export interface ElementAttributesProperty {
      $props: {}
    }
    export interface IntrinsicElements extends NativeElements {
      [name: string]: any
    }
    export interface IntrinsicAttributes extends ReservedProps {}
  }
}
