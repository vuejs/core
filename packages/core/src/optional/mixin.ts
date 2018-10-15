import { Component } from '../component'

interface ComponentConstructor<This = Component> {
  new (): This
}

// mind = blown
type UnionToIntersection<U> = (U extends any
  ? (k: U) => void
  : never) extends ((k: infer I) => void)
  ? I
  : never

type ExtractInstance<T> = T extends (infer U)[]
  ? UnionToIntersection<U extends ComponentConstructor<infer V> ? V : never>
  : never

function mixins<T extends ComponentConstructor[], V = ExtractInstance<T>>(
  ...args: T
): ComponentConstructor<V>
function mixins(...args: any[]): any {
  // TODO
}

/* Example usage

class Foo extends Component<{ foo: number }> {
  test() {

  }
}

class Bar extends Component<{ bar: string }> {
  ok() {

  }
}

class Baz extends mixins(Foo, Bar) {
  created() {
    this.foo
    this.bar
    this.test()
    this.ok()
  }
}

*/
