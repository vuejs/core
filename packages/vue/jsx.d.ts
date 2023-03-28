// global JSX namespace registration
import { JSX as JSXInternal } from './jsx-runtime'

declare global {
  namespace JSX {
    interface Element extends JSXInternal.Element {}
    interface ElementClass extends JSXInternal.ElementClass {}
    interface ElementAttributesProperty
      extends JSXInternal.ElementAttributesProperty {}
    interface IntrinsicElements extends JSXInternal.IntrinsicElements {}
    interface IntrinsicAttributes extends JSXInternal.IntrinsicAttributes {}
  }
}

export {}
