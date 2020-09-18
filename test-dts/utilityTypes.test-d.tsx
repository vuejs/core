import {
  FunctionalComponent,
  ComponentListeners,
  ComponentProps,
  defineComponent,
  expectType,
  expectAssignable
} from './index'

describe('ComponentListeners', () => {
  test('defineComponent', () => {
    const C1 = defineComponent({})
    type C1Listeners = ComponentListeners<typeof C1>
    expectType<Record<string, (...args: any[]) => void>>({} as C1Listeners)

    const C2 = defineComponent({
      emits: ['foo', 'bar']
    })
    type C2Listeners = ComponentListeners<typeof C2>
    expectType<{
      foo: (...args: any[]) => void
      bar: (...args: any[]) => void
    }>({} as C2Listeners)

    const C3 = defineComponent({
      emits: {
        foo: () => true,
        bar: (n: number) => true,
        baz: (n: number, s: string) => true
      }
    })
    type C3Listeners = ComponentListeners<typeof C3>
    expectType<{
      foo: () => void
      bar: (n: number) => void
      baz: (n: number, s: string) => void
    }>({} as C3Listeners)
  })

  test('functionalComponent', () => {
    const C1 = () => <div>Hello world</div>
    type C1Listeners = ComponentListeners<typeof C1>
    expectType<Record<string, (...args: any[]) => void>>({} as C1Listeners)

    const C2: FunctionalComponent<{}, ['foo', 'bar']> = () => (
      <div>Hello world</div>
    )
    type C2Listeners = ComponentListeners<typeof C2>
    expectType<{
      foo: (...args: any[]) => void
      bar: (...args: any[]) => void
    }>({} as C2Listeners)

    type ObjectEmits = {
      foo: () => void
      bar: (n: number) => void
      baz: (n: number, s: string) => void
    }
    const C3: FunctionalComponent<{}, ObjectEmits> = () => (
      <div>Hello world</div>
    )
    type C3Listeners = ComponentListeners<typeof C3>
    expectType<ObjectEmits>({} as C3Listeners)
  })
})

describe('ComponentProps', () => {
  test('defineComponent', () => {
    const C1 = defineComponent({})
    type C1Props = ComponentProps<typeof C1>
    expectAssignable<Required<C1Props>>({})

    const C2 = defineComponent({
      props: ['c2p1', 'c2p2', 'c2p3']
    })
    // NOTE:
    // When we want to test if properties are required or optional,
    // below test does not work because `{ foo: string }` is assignable to `{ foo?: string }`
    //
    //   expectType<{ foo?: string }>({} as { foo: string }) // error expected, but passed
    type C2Props = ComponentProps<typeof C2>
    expectType<{ readonly c2p1: any; readonly c2p2: any; readonly c2p3: any }>(
      {} as Required<C2Props>
    )
    expectAssignable<C2Props['c2p1']>(undefined)
    expectAssignable<C2Props['c2p2']>(undefined)
    expectAssignable<C2Props['c2p3']>(undefined)

    const C3 = defineComponent({
      props: {
        c3p1: String,
        c3p2: { type: Number, required: true },
        c3p3: { type: Boolean, default: true }
      }
    })
    type C3Props = ComponentProps<typeof C3>
    expectType<{
      readonly c3p1: string
      readonly c3p2: number
      readonly c3p3: boolean
    }>({} as Required<C3Props>)
    expectAssignable<C3Props['c3p1']>(undefined)
    expectAssignable<C3Props['c3p3']>(undefined)
    // @ts-expect-error
    expectAssignable<C3Props['c3p2']>(undefined)
  })

  test('defineComponent - extends and mixins', () => {
    const M1 = defineComponent({
      props: ['m1P1']
    })
    const M2 = defineComponent({
      props: {
        m2P1: String,
        m2P2: { type: Number, required: true },
        m2P3: { type: Number, default: 0 }
      }
    })
    const B = defineComponent({
      props: {
        bP1: Boolean
      }
    })

    type CommonPropsExpected = {
      m1P1: any
      m2P1: string
      m2P2: number
      m2P3: number
      bP1: boolean
    }

    const C1 = defineComponent({
      extends: B,
      mixins: [M1, M2]
    })
    type C1Props = ComponentProps<typeof C1>
    expectType<CommonPropsExpected>({} as Required<C1Props>)
    expectAssignable<C1Props['m1P1']>(undefined)
    expectAssignable<C1Props['m2P1']>(undefined)
    expectAssignable<C1Props['m2P3']>(undefined)
    expectAssignable<C1Props['bP1']>(undefined)
    // @ts-expect-error
    expectAssignable<C1Props['m2P2']>(undefined)

    const C2 = defineComponent({
      extends: B,
      mixins: [M1, M2],
      props: ['c2P1']
    })
    type C2Props = ComponentProps<typeof C2>
    expectType<
      CommonPropsExpected & {
        c2P1: any
      }
    >({} as Required<C2Props>)
    expectAssignable<C2Props['m1P1']>(undefined)
    expectAssignable<C2Props['m2P1']>(undefined)
    expectAssignable<C2Props['m2P3']>(undefined)
    expectAssignable<C2Props['bP1']>(undefined)
    expectAssignable<C2Props['c2P1']>(undefined)
    // @ts-expect-error
    expectAssignable<C2Props['m2P2']>(undefined)

    const C3 = defineComponent({
      extends: B,
      mixins: [M1, M2],
      props: {
        c3P1: String,
        c3P2: { type: Number, required: true },
        c3P3: { type: Number, default: 0 }
      }
    })
    type C3Props = ComponentProps<typeof C3>
    expectType<
      CommonPropsExpected & {
        c3P1: string
        c3P2: number
        c3P3: number
      }
    >({} as Required<C3Props>)
    expectAssignable<C3Props['m1P1']>(undefined)
    expectAssignable<C3Props['m2P1']>(undefined)
    expectAssignable<C3Props['m2P3']>(undefined)
    expectAssignable<C3Props['bP1']>(undefined)
    expectAssignable<C3Props['c3P1']>(undefined)
    expectAssignable<C3Props['c3P3']>(undefined)
    // @ts-expect-error
    expectAssignable<C3Props['m2P2']>(undefined)
    // @ts-expect-error
    expectAssignable<C3Props['c3P2']>(undefined)
  })

  test('functionalComponent', () => {
    const C1 = () => <div>Hello world</div>
    type C1Props = ComponentProps<typeof C1>
    expectType<never>({} as keyof C1Props)

    type C2PropsExpected = { name: string; age?: number }
    const C2: FunctionalComponent<C2PropsExpected> = props => (
      <div>Hello {props.name}</div>
    )
    type C2Props = ComponentProps<typeof C2>
    expectType<Required<C2PropsExpected>>({} as Required<C2Props>)
    // @ts-expect-error
    expectAssignable<C2Props['name']>(undefined)
    expectAssignable<C2Props['age']>(undefined)
  })
})
