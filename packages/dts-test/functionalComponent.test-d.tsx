import { h, Text, FunctionalComponent, Component, VNode } from 'vue'
import { expectType } from './utils'

// simple function signature
const Foo = (props: { foo: number }) => h(Text, null, props.foo)

// TSX
expectType<JSX.Element>(<Foo foo={1} />)
expectType<JSX.Element>(<Foo foo={1} key="1" />)
expectType<JSX.Element>(<Foo foo={1} ref="ref" />)
// @ts-expect-error
;<Foo />
//  @ts-expect-error
;<Foo foo="bar" />
//  @ts-expect-error
;<Foo baz="bar" />

// Explicit signature with props + emits
const Bar: FunctionalComponent<
  { foo: number },
  { update: (value: number) => void }
> = (props, { emit }) => {
  expectType<number>(props.foo)

  emit('update', 123)
  //  @ts-expect-error
  emit('nope')
  //  @ts-expect-error
  emit('update')
  //  @ts-expect-error
  emit('update', 'nope')
}

// assigning runtime options
Bar.props = {
  foo: Number,
}
//  @ts-expect-error
Bar.props = { foo: String }

Bar.emits = {
  update: value => value > 1,
}
//  @ts-expect-error
Bar.emits = { baz: () => void 0 }

// TSX
expectType<JSX.Element>(<Bar foo={1} onUpdate={() => {}} />)
//  @ts-expect-error
;<Foo />
//  @ts-expect-error
;<Bar foo="bar" />
//  @ts-expect-error
;<Foo baz="bar" />

const Baz: FunctionalComponent<{}, string[]> = (props, { emit }) => {
  expectType<{}>(props)
  expectType<(event: string) => void>(emit)
}

expectType<Component>(Baz)

const Qux: FunctionalComponent<{}, ['foo', 'bar']> = (props, { emit }) => {
  emit('foo')
  emit('foo', 1, 2)
  emit('bar')
  emit('bar', 1, 2)
}

expectType<Component>(Qux)

const Quux: FunctionalComponent<
  {},
  {},
  {
    default: { foo: number }
    optional?: { foo: number }
  }
> = (props, { emit, slots }) => {
  expectType<{
    default: (scope: { foo: number }) => VNode[]
    optional?: (scope: { foo: number }) => VNode[]
  }>(slots)

  slots.default({ foo: 123 })
  // @ts-expect-error
  slots.default({ foo: 'fesf' })

  slots.optional?.({ foo: 123 })
  // @ts-expect-error
  slots.optional?.({ foo: 'fesf' })
  // @ts-expect-error
  slots.optional({ foo: 123 })
}
expectType<Component>(Quux)
;<Quux />
