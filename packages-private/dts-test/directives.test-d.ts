import { type Directive, type ObjectDirective, vModelText } from 'vue'
import { describe, expectType } from './utils'

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
  expectType<ObjectDirective<any, any, 'trim' | 'number' | 'lazy', string>>(
    vModelText,
  )
  // @ts-expect-error
  expectType<ObjectDirective<any, any, 'not-valid', string>>(vModelText)
})

describe('custom', () => {
  expectType<{
    value: number
    oldValue: number | null
    arg?: 'Arg'
    modifiers: Partial<Record<'a' | 'b', boolean>>
  }>(testDirective<number, 'a' | 'b', 'Arg'>())

  expectType<{
    value: number
    oldValue: number | null
    arg?: 'Arg'
    modifiers: Partial<Record<'a' | 'b', boolean>>
  }>(testDirective<number, 'a', 'Arg'>())

  expectType<{
    value: number
    oldValue: number | null
    arg?: 'Arg'
    modifiers: Partial<Record<'a' | 'b', boolean>>
  }>(testDirective<number, 'a' | 'b', 'Arg'>())

  expectType<{
    value: number
    oldValue: number | null
    arg?: 'Arg'
    modifiers: Partial<Record<'a' | 'b', boolean>>
  }>(testDirective<number, 'a' | 'b', 'Arg'>())

  expectType<{
    value: number
    oldValue: number | null
    arg?: HTMLElement
    modifiers: Partial<Record<'a' | 'b', boolean>>
  }>(testDirective<number, 'a' | 'b', HTMLElement>())
})
