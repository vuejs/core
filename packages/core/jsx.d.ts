declare namespace JSX {
  interface Element {}
  interface ElementClass {
    render(props: any, slots: any, attrs: any): any
  }
  interface ElementAttributesProperty {
    $props: {}
  }
  interface IntrinsicElements {
    [name: string]: any
  }
}
