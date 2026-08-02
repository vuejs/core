// global JSX namespace registration
// somehow we have to copy=pase the jsx-runtime types here to make TypeScript happy
import type {
  NativeElements,
  RenderResultExtensions,
  ReservedProps,
  VNode,
} from '@vue/runtime-dom'

declare global {
  namespace JSX {
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
      [name: string]: any
    }
    export interface IntrinsicAttributes extends ReservedProps {}
  }
}
