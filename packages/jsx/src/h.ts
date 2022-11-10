import { type VNode, h as _h } from '@vue/runtime-core'
import { type HTMLElementAttributesMap } from './html'
import { type SVGElementAttributesMap } from './svg'
import { type ReservedProps } from './vue'

type ElementAttrs<T> = T & ReservedProps
type NativeElements = {
  [K in keyof HTMLElementAttributesMap]: ElementAttrs<
    HTMLElementAttributesMap[K]
  >
} & {
  [K in keyof SVGElementAttributesMap]: ElementAttrs<SVGElementAttributesMap[K]>
}

/**
 * This is only for type support.
 * @public
 */
export const h = _h
export namespace h {
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
}
