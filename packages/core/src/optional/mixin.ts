import { Component } from '../component'
import { createComponentClassFromOptions } from '../componentUtils'
import {
  ComponentOptions,
  resolveComponentOptionsFromClass,
  mergeComponentOptions
} from '../componentOptions'
import { normalizePropsOptions } from '../componentProps'
import { isFunction } from '@vue/shared'

interface ComponentConstructor<This = Component> {
  new (): This
}

interface ComponentConstructorWithMixins<This> {
  new <P = {}, D = {}>(): This & { $data: D } & D & { $props: Readonly<P> } & P
}

// mind = blown
// https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
type UnionToIntersection<U> = (U extends any
  ? (k: U) => void
  : never) extends ((k: infer I) => void)
  ? I
  : never

type ExtractInstance<T> = T extends (infer U)[]
  ? UnionToIntersection<U extends ComponentConstructor<infer V> ? V : never>
  : never

export function mixins<
  T extends ComponentConstructor[] = [],
  V = ExtractInstance<T>
>(...args: T): ComponentConstructorWithMixins<V>
export function mixins(...args: any[]): any {
  let options: ComponentOptions = {}
  args.forEach(mixin => {
    if (isFunction(mixin)) {
      options = mergeComponentOptions(
        options,
        resolveComponentOptionsFromClass(mixin)
      )
    } else {
      mixin.props = normalizePropsOptions(mixin.props)
      options = mergeComponentOptions(options, mixin)
    }
  })
  return createComponentClassFromOptions(options)
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

class Baz extends mixins(Foo, Bar)<{ baz: number }> {
  created() {
    this.foo
    this.bar
    this.baz
    this.test()
    this.ok()
  }
}

*/
