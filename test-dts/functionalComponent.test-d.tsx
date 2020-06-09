import { FunctionalComponent, expectError, expectType } from './index'

// simple function signature
const Foo = (props: { foo: number }) => props.foo

// TSX
expectType<JSX.Element>(<Foo foo={1} />)
// @ts-expect-error
expectError(<Foo />)
//  @ts-expect-error
expectError(<Foo foo="bar" />)
//  @ts-expect-error
expectError(<Foo baz="bar" />)

// Explicit signature with props + emits
const Bar: FunctionalComponent<
  { foo: number },
  { update: (value: number) => void }
> = (props, { emit }) => {
  expectType<number>(props.foo)

  emit('update', 123)
  //  @ts-expect-error
  expectError(emit('nope'))
  //  @ts-expect-error
  expectError(emit('update'))
  //  @ts-expect-error
  expectError(emit('update', 'nope'))
}

// assigning runtime options
Bar.props = {
  foo: Number
}
//  @ts-expect-error
expectError((Bar.props = { foo: String }))

Bar.emits = {
  update: value => value > 1
}
//  @ts-expect-error
expectError((Bar.emits = { baz: () => void 0 }))

// TSX
expectType<JSX.Element>(<Bar foo={1} />)
//  @ts-expect-error
expectError(<Foo />)
//  @ts-expect-error
expectError(<Bar foo="bar" />)
//  @ts-expect-error
expectError(<Foo baz="bar" />)
