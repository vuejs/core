import { h } from './dist/jsx'

declare global {
  namespace JSX {
    interface Element extends h.JSX.Element {}
    interface ElementClass extends h.JSX.ElementClass {}
    interface ElementAttributesProperty
      extends h.JSX.ElementAttributesProperty {}
    interface IntrinsicElements extends h.JSX.IntrinsicElements {}
    interface IntrinsicAttributes extends h.JSX.IntrinsicAttributes {}
    interface ElementChildrenAttribute extends h.JSX.ElementChildrenAttribute {}
  }
}

export {}
