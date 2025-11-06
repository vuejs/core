import type { NativeElements, ReservedProps, VaporRenderResult } from 'vue'

declare global {
  namespace JSX {
    export type Element = VaporRenderResult
    export interface IntrinsicElements extends NativeElements {
      [name: string]: any
    }
    export interface IntrinsicAttributes extends ReservedProps {}
  }
}
