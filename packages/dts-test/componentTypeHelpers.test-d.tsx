import { describe, expectType } from './utils'

import {
  type ComponentData,
  type ComponentEmits,
  type ComponentExpectedProps,
  type ComponentInstance,
  type ComponentProps,
  type ComponentPublicInstance,
  type ComponentSlots,
  type DeclareComponent,
  type DeclareEmits,
  type ExtractComponentOptions,
  type FunctionalComponent,
  type PropType,
  type SetupContext,
  type SlotsType,
  defineAsyncComponent,
  defineComponent,
} from 'vue'

const propsOptions = {
  props: {
    a: String,
    b: Boolean,

    bb: {
      type: Boolean,
      required: true as true,
    },
  },
  slots: {
    default(arg: { msg: string }) {},
  },
  foo: 'bar',
  emits: {
    a: (arg: string) => arg === 'foo',
    b: (arg: number) => arg === 1,
  },
  data() {
    return {
      test: 1,
    }
  },
}

const arrayOptions = {
  // preventing from set as readonly otherwise it breaks typing
  props: ['a', 'b', 'c'] as ['a', 'b', 'c'],
  slots: {
    default(arg: { msg: string }) {},
  },
  foo: 'bar',
  emits: {
    a: (arg: string) => arg === 'foo',
    b: (arg: number) => arg === 1,
  },
  data() {
    return {
      testA: 1,
    }
  },
}

const noPropsOptions = {
  slots: {
    default(arg: { msg: string }) {},
  },
  foo: 'bar',
  emits: {
    a: (arg: string) => arg === 'foo',
    b: (arg: number) => arg === 1,
  },
  data() {
    return {
      testN: 1,
    }
  },
}

const fakeClassComponent = {} as {
  new (): {
    $props: { a: string }

    $slots: {
      default: (arg: { msg: string }) => any
    }

    $emits: ((event: 'a', arg: string) => void) &
      ((event: 'b', arg: number) => void)

    someMethod: (a: number) => void
    foo: number

    data(): { test: number }
  }
}

const functionalComponent =
  (
    props: { a: string },
    ctx: SetupContext<
      {
        a: (arg: string) => true
        b: (arg: number) => true
      },
      SlotsType<{
        foo: (arg: { bar: string }) => any
      }>
    >,
  ) =>
  () => {}

describe('Extract Component Options', () => {
  describe('defineComponent', () => {
    // Component with props
    const CompProps = defineComponent(propsOptions)
    expectType<ExtractComponentOptions<typeof CompProps>>(propsOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof CompProps>>({ bar: 'foo' })

    // component array props
    const CompPropsArray = defineComponent(arrayOptions)
    expectType<ExtractComponentOptions<typeof CompPropsArray>>(arrayOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof CompPropsArray>>({ bar: 'foo' })

    // component no props
    const CompNoProps = defineComponent(noPropsOptions)
    expectType<ExtractComponentOptions<typeof CompNoProps>>(noPropsOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof CompNoProps>>({ bar: 'foo' })

    const Mixins = defineComponent({
      props: ['a1'],
      mixins: [propsOptions, arrayOptions, noPropsOptions],
    })

    expectType<ExtractComponentOptions<typeof Mixins>>({
      props: ['a1'],
      mixins: [propsOptions, arrayOptions, noPropsOptions],
    })
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof Mixins>>({ bar: 'foo' })
  })

  describe('options object', () => {
    // Component with props
    expectType<ExtractComponentOptions<typeof propsOptions>>(propsOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof propsOptions>>({ bar: 'foo' })

    // component array props
    expectType<ExtractComponentOptions<typeof arrayOptions>>(arrayOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof arrayOptions>>({ bar: 'foo' })

    // component no props
    expectType<ExtractComponentOptions<typeof noPropsOptions>>(noPropsOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof noPropsOptions>>({ bar: 'foo' })
  })

  describe('class component', () => {
    expectType<ExtractComponentOptions<typeof fakeClassComponent>>(
      fakeClassComponent,
    )
  })
})

describe('Component Props', () => {
  describe('defineComponent', () => {
    // Component with props
    const CompProps = defineComponent(propsOptions)
    expectType<{
      readonly a?: string | undefined
      readonly b: boolean | undefined
      readonly bb: boolean
    }>({} as ComponentProps<typeof CompProps>)
    // @ts-expect-error checking if is not any
    expectType<{ bar: string }>({} as ComponentProps<typeof CompProps>)

    // component array props
    const CompPropsArray = defineComponent(arrayOptions)
    // aX
    expectType<{
      readonly a?: any
      readonly b?: any
      readonly c?: any
    }>({} as ComponentProps<typeof CompPropsArray>)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>({} as ComponentProps<typeof CompPropsArray>)

    // component no props
    const CompNoProps = defineComponent(noPropsOptions)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>({} as ComponentProps<typeof CompNoProps>)

    const mixin = defineComponent({
      props: ['a1'],
      mixins: [CompProps, CompPropsArray, CompNoProps],

      setup(props) {
        props.a, props.a1
        props.bb
      },
    })
    expectType<{
      a1?: any
      a?: any
      b?: any
      c?: any
      bb: boolean
    }>({} as ComponentProps<typeof mixin>)
  })

  describe('async component', () => {
    const Component = defineAsyncComponent({
      loader: () =>
        Promise.resolve(
          defineComponent({
            props: {
              foo: String,
            },
          }),
        ),
    })

    expectType<{
      foo?: string | undefined
    }>({} as ComponentProps<typeof Component>)
  })

  describe('options object', () => {
    expectType<{
      readonly a?: string | undefined
      readonly b: boolean | undefined
      readonly bb: boolean
    }>({} as ComponentProps<typeof propsOptions>)
    // @ts-expect-error checking if is not any
    expectType<{ bar: string }>({} as ComponentProps<typeof propsOptions>)

    // component array props
    expectType<{
      readonly a?: any
      readonly b?: any
      readonly c?: any
    }>({} as ComponentProps<typeof arrayOptions>)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>({} as ComponentProps<typeof arrayOptions>)

    // component no props
    expectType<{}>({} as ComponentProps<typeof noPropsOptions>)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>({} as ComponentProps<typeof noPropsOptions>)

    const mixin = {
      props: ['a1'] as ['a1'],
      // casting cost to keep the types
      mixins: [propsOptions, arrayOptions, noPropsOptions] as const,
    }
    expectType<{
      a1?: any
      a?: any
      b?: any
      c?: any
      bb: boolean
    }>({} as ComponentProps<typeof mixin>)
  })

  describe('class component', () => {
    const props = {} as ComponentProps<typeof fakeClassComponent>
    expectType<{ a: string }>(props)
    // @ts-expect-error not any
    expectType<boolean>(props)
  })

  describe('functional', () => {
    const props = {} as ComponentProps<typeof functionalComponent>
    expectType<{ a: string }>(props)
    // @ts-expect-error not any
    expectType<boolean>(props)
  })
  describe('functional typed', () => {
    const props = {} as ComponentProps<
      FunctionalComponent<{ a: string }, {}, {}>
    >
    expectType<{ a: string }>(props)
    // @ts-expect-error not any
    expectType<boolean>(props)
  })
})

describe('Component Emits', () => {
  describe('string array', () => {
    const emitArray = {
      emits: ['a', 'b'] as ['a', 'b'],
    }
    expectType<
      ((event: 'a', arg: string) => void) & ((event: 'b', arg: number) => void)
    >({} as ComponentEmits<typeof emitArray>)
    // @ts-expect-error not empty function
    expectType<() => void>({} as ComponentEmits<typeof emitArray>)

    const constEmitArray = {
      emits: ['a', 'b'] as const,
    }
    expectType<
      ((event: 'a', arg: string) => void) & ((event: 'b', arg: number) => void)
    >({} as ComponentEmits<typeof constEmitArray>)
    // @ts-expect-error not empty function
    expectType<() => void>({} as ComponentEmits<typeof constEmitArray>)
  })

  describe('defineComponent', () => {
    // Component with props
    const CompProps = defineComponent(propsOptions)
    expectType<
      ((event: 'a', arg: string) => void) & ((event: 'b', arg: number) => void)
    >({} as ComponentEmits<typeof CompProps>)
    // @ts-expect-error checking if is not any
    expectType<() => void>({} as ComponentEmits<typeof CompProps>)

    // component array props
    const CompPropsArray = defineComponent(arrayOptions)
    expectType<
      ((event: 'a', arg: string) => void) & ((event: 'b', arg: number) => void)
    >({} as ComponentEmits<typeof CompPropsArray>)
    // @ts-expect-error checking if is not any
    expectType<() => void>({} as ComponentEmits<typeof CompPropsArray>)

    // component no props
    const CompNoProps = defineComponent(noPropsOptions)
    expectType<
      ((event: 'a', arg: string) => void) & ((event: 'b', arg: number) => void)
    >({} as ComponentEmits<typeof CompNoProps>)
    // @ts-expect-error checking if is not any
    expectType<() => void>({} as ComponentEmits<typeof CompNoProps>)

    // with SlotsTyped
    const CompSlotsTyped = defineComponent({
      slots: {} as SlotsType<{
        default: (arg: { msg: string }) => any
      }>,

      emits: {
        foo: (arg: string) => true,
      },
    })

    expectType<(event: 'foo', arg: string) => void>(
      {} as ComponentEmits<typeof CompSlotsTyped>,
    )
    // @ts-expect-error checking if is not any or emtpy
    expectType<() => void>({} as ComponentEmits<typeof CompSlotsTyped>)
  })

  describe('async component', () => {
    const Component = defineAsyncComponent({
      loader: () =>
        Promise.resolve(
          defineComponent({
            emits: {
              a: (arg: string) => arg === 'foo',
            },
          }),
        ),
    })

    expectType<(event: 'a', arg: string) => void>(
      {} as ComponentEmits<typeof Component>,
    )

    // @ts-expect-error checking if is not any
    expectType<() => void>({} as ComponentEmits<typeof Component>)
    // @ts-expect-error checking if is not any
    expectType<{ bar: string }>({} as ComponentEmits<typeof Component>)
  })

  describe('options object', () => {
    expectType<
      ((event: 'a', arg: string) => void) & ((event: 'b', arg: number) => void)
    >({} as ComponentEmits<typeof propsOptions>)
    // @ts-expect-error checking if is not any
    expectType<{ bar: string }>({} as ComponentEmits<typeof propsOptions>)

    // component array props
    expectType<
      ((event: 'a', arg: string) => void) & ((event: 'b', arg: number) => void)
    >({} as ComponentEmits<typeof arrayOptions>)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>({} as ComponentEmits<typeof arrayOptions>)

    // component no props
    expectType<{}>({} as ComponentEmits<typeof noPropsOptions>)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>({} as ComponentEmits<typeof noPropsOptions>)
  })

  describe('functional', () => {
    const emits = {} as ComponentEmits<typeof functionalComponent>
    expectType<
      ((event: 'a', arg: string) => void) & ((event: 'b', arg: number) => void)
    >(emits)
    // @ts-expect-error not empty function
    expectType<() => void>(emits)
    // @ts-expect-error not any
    expectType<boolean>(emits)
  })
  describe('functional typed', () => {
    const emits = {} as ComponentEmits<
      FunctionalComponent<
        { a: string },
        {
          a: (arg: string) => true
          b: (arg: number) => true
        },
        {}
      >
    >
    expectType<
      ((event: 'a', arg: string) => void) & ((event: 'b', arg: number) => void)
    >(emits)
    // @ts-expect-error not empty function
    expectType<() => void>(emits)
    // @ts-expect-error not any
    expectType<boolean>(emits)
  })
})

declare function getOptionalProps<T>(o: T): ComponentExpectedProps<T>
describe('ComponentPropsWithDefaultOptional', () => {
  describe('defineComponent', () => {
    // Component with props
    const CompProps = defineComponent(propsOptions)
    const compProps = getOptionalProps(CompProps)
    expectType<{
      a?: string | undefined
      b?: boolean | undefined
      bb: boolean
    }>(compProps)

    // @ts-expect-error checking if is not any
    expectType<{ random: true }>(compProps)

    // component array props
    const CompPropsArray = defineComponent(arrayOptions)
    const compPropsArray = getOptionalProps(CompPropsArray)
    expectType<{
      a?: any
      b?: any
      c?: any
    }>(compPropsArray)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(compPropsArray)

    // component no props
    const CompNoProps = defineComponent(noPropsOptions)
    const compNoProps = getOptionalProps(CompNoProps)
    expectType<{}>(compNoProps)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(compNoProps)

    const Mixin = defineComponent({
      props: ['a1'],
      mixins: [CompProps, CompPropsArray, CompNoProps],

      setup(props) {
        props.a, props.a1
        props.bb
      },
    })
    const mixin = getOptionalProps(Mixin)
    expectType<{
      a1?: any
      a?: any
      b?: any
      c?: any
      bb: boolean
    }>(mixin)
    // @ts-expect-error checking if is not any
    expectType<{ random: true }>(mixin)
  })

  describe('async component', () => {
    const Component = defineAsyncComponent({
      loader: () =>
        Promise.resolve(
          defineComponent({
            props: {
              foo: String,
            },
          }),
        ),
    })
    const component = getOptionalProps(Component)

    expectType<{
      foo?: string | undefined
    }>(component)
  })

  describe('options object', () => {
    const options = getOptionalProps(propsOptions)

    expectType<{
      a?: string | undefined
      b?: boolean | undefined
      bb: boolean
    }>(options)
    // @ts-expect-error checking if is not any
    expectType<{ bar: string }>(options)

    // component array props

    const array = getOptionalProps(arrayOptions)
    expectType<{
      a?: any
      b?: any
      c?: any
    }>(array)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(array)

    // component no props
    const noProps = getOptionalProps(noPropsOptions)
    expectType<{}>(noProps)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(noProps)

    const mixin = getOptionalProps({
      props: ['a1'] as ['a1'],
      // using defineComponent, otherwise is not guaranteed to work
      mixins: [
        defineComponent(propsOptions),
        defineComponent(arrayOptions),
        defineComponent(noPropsOptions),
      ],
    })
    expectType<{
      a1?: any
      a?: any
      b?: any
      c?: any
      bb: boolean
    }>(mixin)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(mixin)
  })

  describe('class component', () => {
    const cc = getOptionalProps(fakeClassComponent)
    expectType<{ a: string }>(cc)

    // @ts-expect-error checking if is not any
    expectType<{ random: number }>(cc)
  })

  describe('functional component', () => {
    const fc = getOptionalProps(functionalComponent)
    expectType<{ a: string }>(fc)
    // @ts-expect-error checking if is not any
    expectType<{ random: number }>(fc)
  })
})

declare function getData<T>(o: T): ComponentData<T>
describe('ComponentData', () => {
  describe('defineComponent', () => {
    // Component with props
    const CompProps = defineComponent(propsOptions)
    const compProps = getData(CompProps)
    expectType<{ test: number }>(compProps)

    // @ts-expect-error checking if is not any
    expectType<{ random: true }>(compProps)

    // component array props
    const CompPropsArray = defineComponent(arrayOptions)
    const compPropsArray = getData(CompPropsArray)
    expectType<{ testA: number }>(compPropsArray)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(compPropsArray)

    // component no props
    const CompNoProps = defineComponent(noPropsOptions)
    const compNoProps = getData(CompNoProps)
    expectType<{
      testN: number
    }>(compNoProps)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(compNoProps)

    const Mixin = defineComponent({
      props: ['a1'],
      mixins: [CompProps, CompPropsArray, CompNoProps],

      setup(props) {
        props.a, props.a1
        props.bb
      },
    })
    const mixin = getData(Mixin)
    expectType<{
      test: number
      testA: number
      testN: number
    }>(mixin)
    // @ts-expect-error checking if is not any
    expectType<{ random: true }>(mixin)
  })

  describe('async component', () => {
    const Component = defineAsyncComponent({
      loader: () =>
        Promise.resolve(
          defineComponent({
            data() {
              return {
                foo: 'foo',
              }
            },
          }),
        ),
    })
    const component = getData(Component)
    expectType<{
      foo?: string
    }>(component)
  })

  describe('options object', () => {
    const options = getData(propsOptions)

    expectType<{ test: number }>(options)
    // @ts-expect-error checking if is not any
    expectType<{ bar: string }>(options)

    // component array props

    const array = getData(arrayOptions)
    expectType<{ testA: number }>(array)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(array)

    // component no props
    const noProps = getData(noPropsOptions)
    expectType<{
      testN: number
    }>(noProps)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(noProps)

    const mixin = getData({
      props: ['a1'] as ['a1'],
      // using defineComponent, otherwise is not guaranteed to work
      mixins: [
        defineComponent(propsOptions),
        defineComponent(arrayOptions),
        defineComponent(noPropsOptions),
      ],
    })
    expectType<{ test: number; testA: number; testN: number }>(mixin)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(mixin)
  })

  describe('class component', () => {
    const cc = getData(fakeClassComponent)
    expectType<{ test: number }>(cc)

    // @ts-expect-error checking if is not any
    expectType<{ random: number }>(cc)
  })

  describe('functional component', () => {
    const fc = getData(functionalComponent)
    expectType<{}>(fc)
    // @ts-expect-error checking if is not any
    expectType<{ random: number }>(fc)
  })

  describe('complex cases', () => {
    const setup = getData(
      defineComponent({
        setup() {
          return {
            a: 1,
          }
        },
      }),
    )
    expectType<{ a: number }>(setup)
    // @ts-expect-error
    expectType<{ a: string }>(setup)

    const dataSetup = getData(
      defineComponent({
        data: () => ({ a: 1 }),
        setup() {
          return {
            b: 1,
          }
        },
      }),
    )
    expectType<{ a: number; b: number }>(dataSetup)
    // @ts-expect-error
    expectType<{ a: string }>(dataSetup)

    const setupOverride = getData(
      defineComponent({
        data: () => ({ foo: 1 }),

        setup() {
          return {
            foo: '1',
          }
        },
      }),
    )
    expectType<{ foo: string }>(setupOverride)
    // @ts-expect-error
    expectType<{ foo: number }>(setupOverride)

    const mixin = getData(
      defineComponent({
        mixins: [
          defineComponent(propsOptions),
          defineComponent(arrayOptions),
          defineComponent(noPropsOptions),
        ],
      }),
    )

    expectType<{
      test: number
      testN: number
      testA: number
    }>(mixin)
    // @ts-expect-error
    expectType<{ test: 'string' }>(mixin)

    const mixinData = getData({
      mixins: [
        defineComponent(propsOptions),
        defineComponent(arrayOptions),
        defineComponent(noPropsOptions),
      ],
      data() {
        return { foo: 1 }
      },
    })
    expectType<{
      test: number
      testN: number
      testA: number
      foo: number
    }>(mixinData)
    // @ts-expect-error
    expectType<{ test: string }>(mixinData)

    const mixinDataOverride = getData({
      mixins: [
        defineComponent(propsOptions),
        defineComponent(arrayOptions),
        defineComponent(noPropsOptions),
      ],
      data() {
        return { test: 'string' }
      },
    })
    expectType<{
      test: string
      testN: number
      testA: number
    }>(mixinDataOverride)
    // @ts-expect-error
    expectType<{ test: number }>(mixinDataOverride)

    const mixinSetup = getData({
      mixins: [
        defineComponent(propsOptions),
        defineComponent(arrayOptions),
        defineComponent(noPropsOptions),
      ],
      setup() {
        return { foo: 1 }
      },
    })
    expectType<{
      test: number
      testN: number
      testA: number
      foo: number
    }>(mixinSetup)
    // @ts-expect-error
    expectType<{ test: string }>(mixinSetup)

    const mixinSetupOverride = getData({
      mixins: [
        defineComponent(propsOptions),
        defineComponent(arrayOptions),
        defineComponent(noPropsOptions),
      ],
      setup() {
        return { test: 'string' }
      },
    })

    expectType<{
      test: string
      testN: number
      testA: number
    }>(mixinSetupOverride)
    // @ts-expect-error
    expectType<{ test: number }>(mixinSetupOverride)

    const mixinOverride = getData({
      mixins: [
        defineComponent(propsOptions),
        defineComponent(arrayOptions),
        defineComponent(noPropsOptions),
      ],
      setup() {
        return { test: 'string' }
      },
      data() {
        return { test: { a: 1 } }
      },
    })

    expectType<{
      test: string
      testN: number
      testA: number
    }>(mixinOverride)
    // @ts-expect-error
    expectType<{ test: number }>(mixinOverride)

    const extend = getData(
      defineComponent({
        extends: defineComponent(propsOptions),
        data() {
          return { foo: 1 }
        },
      }),
    )
    expectType<{
      test: number
      foo: number
    }>(extend)
    // @ts-expect-error
    expectType<{ test: string }>(extend)
  })
})

declare function getSlots<T>(o: T): ComponentSlots<T>
describe('ComponentSlots', () => {
  describe('defineComponent', () => {
    // Component with props
    const CompProps = defineComponent(propsOptions)
    const compProps = getSlots(CompProps)

    expectType<{
      default: (arg: { msg: string }) => any
    }>(compProps)

    // @ts-expect-error checking if is not any
    expectType<{ default: true }>(compProps)

    // component array props
    const CompPropsArray = defineComponent(arrayOptions)
    const compPropsArray = getSlots(CompPropsArray)
    expectType<{
      default: (arg: { msg: string }) => any
    }>(compPropsArray)
    // @ts-expect-error checking if is not any
    expectType<{ default: true }>(compPropsArray)

    // component no props
    const CompNoProps = defineComponent(noPropsOptions)
    const compNoProps = getSlots(CompNoProps)
    expectType<{}>(compNoProps)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(compNoProps)

    const Mixin = defineComponent({
      props: ['a1'],
      mixins: [CompProps, CompPropsArray, CompNoProps],

      slots: {} as SlotsType<{
        default: (arg: { test: number }) => any
        test: { foo: string }
      }>,

      setup(props) {
        props.a, props.a1
        props.bb
      },
    })
    const mixin = getSlots(Mixin)
    expectType<{
      default: (arg: { test: number }) => any
      test: (arg: { foo: string }) => any
    }>(mixin)
    // @ts-expect-error checking if is not any
    expectType<{ random: true }>(mixin)

    // slotType

    const slotType = getSlots(
      defineComponent({
        slots: {} as SlotsType<{
          default: { foo: number }
          test: { bar?: string }
        }>,
      }),
    )

    expectType<{
      default: (arg: { foo: number }) => any
      test: (arg: { bar?: string }) => any
    }>(slotType)

    // object based slots

    const objSlots = getSlots(
      defineComponent({
        slots: {
          test: {} as { a: number },
        },
      }),
    )

    expectType<{
      test: (arg: { a: number }) => any
    }>(objSlots)

    expectType<{
      test: (arg: number) => any
      // @ts-expect-error not any
    }>(objSlots)
  })

  describe('async component', () => {
    const Component = defineAsyncComponent({
      loader: () =>
        Promise.resolve(
          defineComponent({
            slots: {} as SlotsType<{
              test: { foo: number }
            }>,
          }),
        ),
    })
    const component = getSlots(Component)
    expectType<{
      test: (arg: { foo: number }) => any
    }>(component)
  })

  describe('options object', () => {
    const options = getSlots(propsOptions)

    expectType<{ default: (arg: { msg: string }) => any }>(options)
    // @ts-expect-error checking if is not any
    expectType<{ bar: string }>(options)

    // component array props

    const array = getSlots(arrayOptions)
    expectType<{
      default: (arg: { msg: string }) => any
    }>(array)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(array)

    // component no props
    const noProps = getSlots(noPropsOptions)
    expectType<{}>(noProps)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(noProps)

    const mixin = getSlots({
      props: ['a1'] as ['a1'],
      // using defineComponent, otherwise is not guaranteed to work
      mixins: [
        defineComponent(propsOptions),
        defineComponent(arrayOptions),
        defineComponent(noPropsOptions),
      ],
      slots: {} as SlotsType<{
        default: (arg: { test: number }) => any
        test: { foo: string }
      }>,
    })
    expectType<{
      default: (arg: { test: number }) => any
      test: (arg: { foo: string }) => any
    }>(mixin)
    // @ts-expect-error checking if is not any
    expectType<{ bar: 'foo' }>(mixin)

    // slotType

    const slotType = getSlots({
      slots: {} as SlotsType<{
        default: { foo: number }
        test: { bar?: string }
      }>,
    })

    expectType<{
      default: (arg: { foo: number }) => any
      test: (arg: { bar?: string }) => any
    }>(slotType)

    // object based slots

    const objSlots = getSlots({
      slots: {
        test: {} as { a: number },
      },
    })

    expectType<{
      test: (arg: { a: number }) => any
    }>(objSlots)

    expectType<{
      test: (arg: number) => any
      // @ts-expect-error not any
    }>(objSlots)
  })

  describe('class component', () => {
    const cc = getSlots(fakeClassComponent)
    expectType<{ default: (arg: { msg: string }) => any }>(cc)

    // @ts-expect-error checking if is not any
    expectType<{ random: number }>(cc)

    // Volar
    const volar = getSlots(
      {} as {
        new (): {
          $slots: {
            default?(_: {}): any
            named?(_: {}): any
            withDefault?(_: {}): any
            scoped?(_: { aBoolean: any; aString: any; anObject: any }): any
            insideTable?(_: {}): any
            scopedWithDefault?(_: {
              aBoolean: any
              aString: any
              anObject: any
            }): any
          }
        }
      },
    )

    expectType<{
      default?(_: {}): any
      named?(_: {}): any
      withDefault?(_: {}): any
      scoped?(_: { aBoolean: any; aString: any; anObject: any }): any
      insideTable?(_: {}): any
      scopedWithDefault?(_: { aBoolean: any; aString: any; anObject: any }): any
    }>(volar)
  })

  describe('functional component', () => {
    const fc = getSlots(functionalComponent)
    expectType<{ foo: (arg: { bar: string }) => any }>(fc)
    // @ts-expect-error checking if is not any
    expectType<{ random: number }>(fc)
  })
})

describe('DeclareComponent', () => {
  const CompProps = {} as DeclareComponent<{ test: string | undefined }>

  expectType<{
    type: PropType<string>
    required: false
  }>(CompProps.props.test)

  // @ts-expect-error not any
  expectType<{ a: 1 }>(CompProps.$props.test)

  const GenericCompDeclaration = defineComponent({
    props: {
      test: {
        type: String,
        required: true,
      },
    },
  }) as DeclareComponent<{
    new <T extends string>(): {
      $props: {
        test: T
      }
    }
  }>

  expectType<{
    type: PropType<string>
    required: true
  }>(GenericCompDeclaration.props.test)

  const GenericComp = new GenericCompDeclaration<'bar'>()
  expectType<'bar'>(GenericComp.$props.test)

  // @ts-expect-error not any
  expectType<{ a: 1 }>(GenericComp.$props.test)

  describe('Full Generic example', () => {
    const Comp = defineComponent({
      props: {
        multiple: Boolean,
        modelValue: {
          type: null,
          required: true,
        },
        options: {
          type: Array,
          required: true,
        },
      },
    }) as unknown as DeclareComponent<{
      new <TOption, Multiple extends boolean = false>(): {
        $props: {
          multiple?: Multiple
          modelValue: Multiple extends true ? Array<TOption> : TOption
          options: Array<{ label: string; value: TOption }>
        }
      }
    }>

    ;<Comp options={[{ label: 'foo', value: 1 }]} modelValue={1} />
    // @ts-expect-error not right value
    ;<Comp options={[{ label: 'foo', value: 1 }]} modelValue={'1'} />
    ;<Comp multiple options={[{ label: 'foo', value: 1 }]} modelValue={[1]} />
    // @ts-expect-error not right value
    ;<Comp multiple options={[{ label: 'foo', value: 1 }]} modelValue={['1']} />
  })
})

describe('DeclareEmits', () => {
  {
    // empty object
    const emit = {} as DeclareEmits<{}>
    expectType<{ (event: never, ...args: any[]): void }>(emit)

    // @ts-expect-error not any
    expectType<{ (event: 'random', ...args: any[]): void }>(emit)
  }
  {
    // array
    const emit = {} as DeclareEmits<['foo', 'bar']>
    expectType<{ (event: 'foo' | 'bar', ...args: any[]): void }>(emit)
    // @ts-expect-error not any
    expectType<{ (event: 'random', ...args: any[]): void }>(emit)
  }
  {
    // options
    const emit = {} as DeclareEmits<{
      foo: (arg: number) => true
      bar: (arg: string, other: number) => true
    }>
    expectType<{
      (event: 'foo', arg: number): void
      (event: 'bar', arg: string, other: number): void
    }>(emit)

    // @ts-expect-error not any
    expectType<{ (event: 'random', ...args: any[]): void }>(emit)
  }
  {
    // short options
    const emit = {} as DeclareEmits<{ foo: [number]; bar: [string, number] }>
    expectType<{
      (event: 'foo', args_0: number): void
      (event: 'bar', args_0: string, args_1: number): void
    }>(emit)

    // @ts-expect-error not any
    expectType<{ (event: 'random', ...args: any[]): void }>(emit)
  }
  {
    // emit function
    const emit = {} as DeclareEmits<{
      (event: 'foo', arg: number): void
      (event: 'bar', test: string): void
    }>
    expectType<{
      (event: 'foo', arg: number): void
      (event: 'bar', test: string): void
    }>(emit)
    // @ts-expect-error not any
    expectType<{ (event: 'random', ...args: any[]): void }>(emit)
  }
})

// Component Instance

declare function retrieveComponentInstance<T>(
  component: T,
): ComponentInstance<T>

expectType<ComponentPublicInstance>(
  retrieveComponentInstance(defineComponent({})),
)

expectType<ComponentPublicInstance>(
  retrieveComponentInstance(
    defineComponent({
      props: {
        a: String,
      },
    }),
  ),
)
