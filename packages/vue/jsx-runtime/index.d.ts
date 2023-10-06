import type {
  VNode,
  ReservedProps,
  NativeElements,
  VNodeRef
} from '@vue/runtime-dom'

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

  export interface IntrinsicClassAttributes<T> extends ReservedProps {}

  // managed based props, this will be used to override the props defined
  // used mainly to set `ref` property correct
  export type LibraryManagedAttributes<C, P> = {
    ref?: P extends { ref?: infer R } // it already exists, most likely NativeElement
      ? R
      : VNodeRef<
          C extends { new (): infer I }
            ? I
            : C extends FunctionalComponent
            ? C
            : C extends FunctionalComponent<infer Props, infer E>
            ? E extends EmitsOptions
              ? ComponentPublicInstance<Props, {}, {}, {}, {}, E>
              : ComponentPublicInstance<Props>
            : C extends (props: infer Props) => any
            ? ComponentPublicInstance<Props>
            : C extends () => any
            ? ComponentPublicInstance<{}>
            : Element | ComponentPublicInstance
        >
  } & P
}
