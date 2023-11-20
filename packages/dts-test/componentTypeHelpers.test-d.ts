import { expectType, describe } from './utils'

import {
  ExtractComponentOptions,
  ComponentProps,
  defineComponent,
  defineAsyncComponent,
  ComponentInstance,
  CreateComponentPublicInstance,
  ComponentPublicInstance,
  ComponentPropsWithDefaultOptional,
  DefineComponentOptions,
  ComputedOptions,
  MethodOptions,
  ComponentOptionsMixin,
  EmitsOptions,
  ComponentInjectOptions,
  SlotsType,
  DefineComponent,
  ComponentData,
  ComponentSlots,
  SetupContext,
  DeclareComponent,
  PropType
} from 'vue'

const propsOptions = {
  props: {
    a: String,
    b: Boolean,

    bb: {
      type: Boolean,
      required: true as true
    }
  },
  slots: {
    default(arg: { msg: string }) {}
  },
  foo: 'bar',
  data() {
    return {
      test: 1
    }
  }
}

const arrayOptions = {
  // preventing from set as readonly otherwise it breaks typing
  props: ['a', 'b', 'c'] as ['a', 'b', 'c'],
  slots: {
    default(arg: { msg: string }) {}
  },
  foo: 'bar',
  data() {
    return {
      testA: 1
    }
  }
}

const noPropsOptions = {
  slots: {
    default(arg: { msg: string }) {}
  },
  foo: 'bar',
  data() {
    return {
      testN: 1
    }
  }
}

const fakeClassComponent = {} as {
  new (): {
    $props: { a: string }

    $slots: {
      default: (arg: { msg: string }) => any
    }

    someMethod: (a: number) => void
    foo: number

    data(): { test: number }
  }
}

defineComponent
const functionalComponent =
  (
    props: { a: string },
    ctx: SetupContext<
      {},
      SlotsType<{
        foo: (arg: { bar: string }) => any
      }>
    >
  ) =>
  () => {}

// const mixIn = {
//   props: ['a1'],
//   mixins: [propsOptions, arrayOptions, noPropsOptions]
// }

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
      mixins: [propsOptions, arrayOptions, noPropsOptions]
    })

    expectType<ExtractComponentOptions<typeof Mixins>>({
      props: ['a1'],
      mixins: [propsOptions, arrayOptions, noPropsOptions]
    })
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof Mixins>>({ bar: 'foo' })
  })

  // describe('async component', () => {
  //   const Component = defineAsyncComponent({
  //     loader: () =>
  //       Promise.resolve(
  //         defineComponent({
  //           foo: 'bar'
  //         })
  //       )
  //   })

  //   // NOTE not sure if this is the intention since Component.foo is undefined
  //   expectType<ExtractComponentOptions<typeof Component>>({})
  // })

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
      fakeClassComponent
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
      }
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
              foo: String
            }
          })
        )
    })

    // NOTE not sure if this is the intention since Component.foo is undefined
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
      mixins: [propsOptions, arrayOptions, noPropsOptions] as const
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
    expectType<{ a: string }>({} as ComponentProps<typeof fakeClassComponent>)
  })
})

declare function getOptionalProps<T>(o: T): ComponentPropsWithDefaultOptional<T>
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
      }
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
              foo: String
            }
          })
        )
    })
    const component = getOptionalProps(Component)

    // NOTE not sure if this is the intention since Component.foo is undefined
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
        defineComponent(noPropsOptions)
      ]
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
      }
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

  // describe('async component', () => {
  //   const Component = defineAsyncComponent({
  //     loader: () =>
  //       Promise.resolve(
  //         defineComponent({
  //           props: {
  //             foo: String
  //           }
  //         })
  //       )
  //   })
  //   const component = getData(Component)

  //   // NOTE not sure if this is the intention since Component.foo is undefined
  //   expectType<{
  //     foo?: string | undefined
  //   }>(component)
  // })

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
        defineComponent(noPropsOptions)
      ]
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
      }
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
        }>
      })
    )

    expectType<{
      default: (arg: { foo: number }) => any
      test: (arg: { bar?: string }) => any
    }>(slotType)

    // object based slots

    const objSlots = getSlots(
      defineComponent({
        slots: {
          test: {} as { a: number }
        }
      })
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
            }>
          })
        )
    })
    const component = getSlots(Component)

    // NOTE not sure if this is the intention since Component.foo is undefined
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
        defineComponent(noPropsOptions)
      ],
      slots: {} as SlotsType<{
        default: (arg: { test: number }) => any
        test: { foo: string }
      }>
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
      }>
    })

    expectType<{
      default: (arg: { foo: number }) => any
      test: (arg: { bar?: string }) => any
    }>(slotType)

    // object based slots

    const objSlots = getSlots({
      slots: {
        test: {} as { a: number }
      }
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
      }
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
        required: true
      }
    }
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
})

// Component Instance

declare function retrieveComponentInstance<T>(
  component: T
): ComponentInstance<T>

expectType<ComponentPublicInstance>(
  retrieveComponentInstance(defineComponent({}))
)

expectType<ComponentPublicInstance>(
  retrieveComponentInstance(
    defineComponent({
      props: {
        a: String
      }
    })
  )
)

const b = retrieveComponentInstance(
  defineComponent({
    emits: {
      test: () => true
    }
  })
)
const a = defineComponent({
  props: [],
  emits: {
    a: (v: string) => true
  }
})

declare function test<T>(t: T): ComponentInstance<T>
declare function test2<T extends ComponentPublicInstance>(
  t: T
): CreateComponentPublicInstance<T>

const aa = test(a)

aa.$emit
bb.$emit

declare function ttt<T>(t: T, t2: T): T
ttt(aa.$emit, bb.$emit)

declare const bb: ComponentPublicInstance

declare function gettingDefineComponentProps<
  T extends Parameters<typeof defineComponent>[0]
>(opt: T): DefineComponent<T>

const axxx = extraPropsOptional({
  props: {
    a: String
  },
  setup(props) {
    props
  }
})

declare function extraPropsOptional<
  Props = never,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  Options = {}
>(
  o: DefineComponentOptions<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    I,
    II,
    S,
    Options
  >
): ComponentPropsWithDefaultOptional<
  DefineComponentOptions<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    I,
    II,
    S,
    Options
  >
>

// declare function antoher<
//   T extends DefineComponent<
//     PropsOrOptions,
//     any,
//     any,
//     any,
//     any,
//     any,
//     any,
//     any,
//     any,
//     any
//   >,
//   PropsOrOptions extends object
// >(o: T): ComponentInstance<T> & { LOL: T}
// const Foo = {
//   props: ['obj', 'foo'] as ['obj', 'foo'],
//   template: `
//     <div>
//       <div v-if="obj.foo()">foo</div>
//     </div>
//   `
// }

// const asd = antoher(Foo)
// asd.$props.obj
// const axxx = defineComponent({
//   props: ['ax']
// })
// const asd = extraPropsOptional({
//   mixins: [axxx],
//   props: {
//     axx: String
//   },
//   setup(props) {
//   }
// })

// const aasd : keyof {}

// asd.axx
// asd.ax
// asd.asad
