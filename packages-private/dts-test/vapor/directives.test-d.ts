import {
  type DirectiveModifiers,
  type VaporDirective,
  withVaporDirectives,
} from 'vue'
import { type IsAny, describe, expectType } from '../utils'

describe('custom directive element', () => {
  const directive: VaporDirective = element => {
    expectType<Element>(element)
  }

  expectType<VaporDirective>(directive)

  const inputDirective: VaporDirective<HTMLInputElement> = element => {
    expectType<HTMLInputElement>(element)
  }

  expectType<VaporDirective<HTMLInputElement>>(inputDirective)
})

describe('custom directive value', () => {
  const directive: VaporDirective<Element, number> = (_element, value) => {
    expectType<(() => number) | undefined>(value)

    if (value) {
      expectType<number>(value())
      expectType<false>({} as IsAny<ReturnType<typeof value>>)

      // @ts-expect-error value should retain its declared type
      expectType<string>(value())
    }
  }

  expectType<VaporDirective<Element, number>>(directive)
})

describe('custom directive argument and modifiers', () => {
  const directive: VaporDirective<
    HTMLDivElement,
    number,
    'foo' | 'bar',
    'arg'
  > = (_element, _value, argument, modifiers) => {
    expectType<'arg' | undefined>(argument)
    expectType<DirectiveModifiers<'foo' | 'bar'> | undefined>(modifiers)

    if (argument) {
      expectType<false>({} as IsAny<typeof argument>)

      // @ts-expect-error argument should retain its declared type
      expectType<'other'>(argument)
    }

    if (modifiers) {
      expectType<boolean | undefined>(modifiers.foo)
      expectType<boolean | undefined>(modifiers.bar)

      // @ts-expect-error undeclared modifiers should not be available
      modifiers.baz
    }
  }

  expectType<VaporDirective<HTMLDivElement, number, 'foo' | 'bar', 'arg'>>(
    directive,
  )

  withVaporDirectives({} as HTMLDivElement, [
    [directive, () => 1, 'arg', { foo: true }],
  ])
})
