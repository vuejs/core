import type { OverloadParameters } from '../src'

// the call signatures below are what `defineEmits<{ ... }>()` generates
describe('OverloadParameters', () => {
  test('call signatures', () => {
    type Emit = {
      (e: 'prev', value: number): void
      (e: 'done', value: string, extra: boolean): void
    }
    expectTypeOf<OverloadParameters<Emit>>().toEqualTypeOf<
      [e: 'prev', value: number] | [e: 'done', value: string, extra: boolean]
    >()
  })

  // #14323
  test('trailing void parameter', () => {
    type Emit = {
      (e: 'next', value: void): void
      (e: 'prev', value: number): void
      (e: 'done', value: string, extra: boolean): void
    }
    expectTypeOf<OverloadParameters<Emit>>().toEqualTypeOf<
      | [e: 'next', value?: void]
      | [e: 'prev', value: number]
      | [e: 'done', value: string, extra: boolean]
    >()

    type Single = { (e: 'next', value: void): void }
    expectTypeOf<OverloadParameters<Single>>().toEqualTypeOf<
      [e: 'next', value?: void]
    >()

    type Last = {
      (e: 'prev', value: number): void
      (e: 'next', value: void): void
    }
    expectTypeOf<OverloadParameters<Last>>().toEqualTypeOf<
      [e: 'prev', value: number] | [e: 'next', value?: void]
    >()

    type Mixed = {
      (e: 'a', value: string | void): void
      (e: 'b', first: void, second: void): void
      (e: 'c', value?: void): void
      (e: 'd', value?: number): void
    }
    expectTypeOf<OverloadParameters<Mixed>>().toEqualTypeOf<
      | [e: 'a', value?: string | void]
      | [e: 'b', first?: void, second?: void]
      | [e: 'c', value?: void]
      | [e: 'd', value?: number]
    >()
  })

  test('keeps every overload', () => {
    type Emit = {
      (e: 'o1', value: void): void
      (e: 'o2', value: number): void
      (e: 'o3', value: number): void
      (e: 'o4', value: number): void
      (e: 'o5', value: number): void
      (e: 'o6', value: void): void
      (e: 'o7', value: number): void
      (e: 'o8', value: number): void
      (e: 'o9', value: number): void
      (e: 'o10', value: number): void
      (e: 'o11', value: void): void
      (e: 'o12', value: number): void
      (e: 'o13', value: number): void
      (e: 'o14', value: number): void
      (e: 'o15', value: number): void
      (e: 'o16', value: void): void
      (e: 'o17', value: number): void
      (e: 'o18', value: number): void
      (e: 'o19', value: number): void
      (e: 'o20', value: number): void
    }
    expectTypeOf<OverloadParameters<Emit>[0]>().toEqualTypeOf<
      | 'o1'
      | 'o2'
      | 'o3'
      | 'o4'
      | 'o5'
      | 'o6'
      | 'o7'
      | 'o8'
      | 'o9'
      | 'o10'
      | 'o11'
      | 'o12'
      | 'o13'
      | 'o14'
      | 'o15'
      | 'o16'
      | 'o17'
      | 'o18'
      | 'o19'
      | 'o20'
    >()
    expectTypeOf<
      Extract<OverloadParameters<Emit>, [e: 'o16', ...any[]]>
    >().toEqualTypeOf<[e: 'o16', value?: void]>()
  })
})
