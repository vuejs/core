import { type Directive, type ObjectDirective, vModelText } from 'vue'
import { describe, expectAssignable, expectType } from './utils'

type ExtractBinding<T> = T extends (
  el: any,
  binding: infer B,
  vnode: any,
  prev: any,
) => any
  ? B
  : never

declare function testDirective<
  Value,
  Modifiers extends string = string,
  Arg = any,
>(): ExtractBinding<Directive<any, Value, Modifiers, Arg>>

describe('vmodel', () => {
  expectAssignable<
    ObjectDirective<any, any, 'trim' | 'number' | 'lazy', string>
  >(vModelText)
  // @ts-expect-error
  expectType(vModelText, {} as ObjectDirective<any, any, 'not-valid', string>)
})

describe('custom', () => {
  expectAssignable<{
    value: number
    oldValue: number | null
    arg?: 'Arg'
    modifiers: Partial<Record<'a' | 'b', boolean>>
  }>(testDirective<number, 'a' | 'b', 'Arg'>())

  expectAssignable<{
    value: number
    oldValue: number | null
    arg?: 'Arg'
    modifiers: Record<'a' | 'b', boolean>
    // @ts-expect-error
  }>(testDirective<number, 'a', 'Arg'>())

  expectAssignable<{
    value: number
    oldValue: number | null
    arg?: 'Arg'
    modifiers: Partial<Record<'a' | 'b', boolean>>
    // @ts-expect-error
  }>(testDirective<number, 'a' | 'b', 'Argx'>())

  expectAssignable<{
    value: number
    oldValue: number | null
    arg?: 'Arg'
    modifiers: Partial<Record<'a' | 'b', boolean>>
    // @ts-expect-error
  }>(testDirective<string, 'a' | 'b', 'Arg'>())

  expectAssignable<{
    value: number
    oldValue: number | null
    arg?: HTMLElement
    modifiers: Partial<Record<'a' | 'b', boolean>>
  }>(testDirective<number, 'a' | 'b', HTMLElement>())

  expectAssignable<{
    value: number
    oldValue: number | null
    arg?: HTMLElement
    modifiers: Partial<Record<'a' | 'b', boolean>>
    // @ts-expect-error
  }>(testDirective<number, 'a' | 'b', string>())

  expectAssignable<{
    value: number
    oldValue: number | null
    arg?: HTMLElement
    modifiers: Partial<Record<'a' | 'b', boolean>>
  }>(testDirective<number, 'a' | 'b'>())
})
