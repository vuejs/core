import { expectError, expectType } from 'tsd'
import { FunctionalComponent } from './index'

// simple function signature
const Foo = (props: { foo: number }) => props.foo

// TSX
expectType<JSX.Element>(<Foo foo={1} />)
expectError(<Foo />)
expectError(<Foo foo="bar" />)

// Explicit signature with props + emits
const Bar: FunctionalComponent<
  { foo: number },
  { update: (value: number) => void }
> = (props, { emit }) => {
  expectType<number>(props.foo)

  emit('update', 123)
  expectError(emit('nope'))
  expectError(emit('update'))
  expectError(emit('update', 'nope'))
}

// assigning runtime options
Bar.props = {
  foo: Number
}
expectError((Bar.props = { foo: String }))

Bar.emits = {
  update: value => value > 1
}
expectError((Bar.emits = { baz: () => void 0 }))

// TSX
expectType<JSX.Element>(<Bar foo={1} />)
expectError(<Bar />)
expectError(<Bar foo="bar" />)
