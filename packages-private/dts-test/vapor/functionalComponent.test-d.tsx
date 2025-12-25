import type { FunctionalVaporComponent } from 'vue'
import { expectType } from '../utils'
import type { Block } from 'vue'

// simple function signature
const VaporComp = (props: { foo: number }) => [<div>123</div>]

// TSX
expectType<JSX.Element>(<VaporComp foo={1} />)
expectType<JSX.Element>(<VaporComp foo={1} key="1" />)
expectType<JSX.Element>(<VaporComp foo={1} ref="ref" />)
// @ts-expect-error
;<Foo />
//  @ts-expect-error
;<Foo foo="bar" />
//  @ts-expect-error
;<Foo baz="bar" />

// Explicit signature with props + emits
const Bar: FunctionalVaporComponent<
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
  return []
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

const Quux: FunctionalVaporComponent<
  {},
  {},
  {
    default: (props: { foo: number }) => Block
    optional?: (props: { foo: number }) => Block
  }
> = (props, { emit, slots }) => {
  expectType<{
    default: (scope: { foo: number }) => Block
    optional?: (scope: { foo: number }) => Block
  }>(slots)

  slots.default({ foo: 123 })
  // @ts-expect-error
  slots.default({ foo: 'fesf' })

  slots.optional?.({ foo: 123 })
  // @ts-expect-error
  slots.optional?.({ foo: 'fesf' })
  // @ts-expect-error
  slots.optional({ foo: 123 })
  return []
}
;<Quux />
