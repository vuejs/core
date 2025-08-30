/* eslint-disable @typescript-eslint/prefer-ts-expect-error */
// global JSX namespace registration
// somehow we have to copy=pase the jsx-runtime types here to make TypeScript happy
import type { NativeElements, ReservedProps, VNode } from '@vue/runtime-dom'
import type { Block } from '@vue/runtime-vapor'

declare global {
  namespace JSX {
    export type Element = VNode | Block
    export interface IntrinsicElements extends NativeElements {
      // allow arbitrary elements
      // @ts-ignore suppress ts:2374 = Duplicate string index signature.
      [name: string]: any
    }
    export interface IntrinsicAttributes extends ReservedProps {}
  }
}
