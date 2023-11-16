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
  ComponentDefineOptions,
  ComputedOptions,
  MethodOptions,
  ComponentOptionsMixin,
  EmitsOptions,
  ComponentInjectOptions,
  SlotsType,
  DefineComponent
} from 'vue'

const propsOptions = {
  props: {
    a: String,
    b: Boolean,

    bb: {
      type: Boolean,
      required: true
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
      test: 1
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
      test: 1
    }
  }
}

const fakeClassComponent = {} as {
  new (): { $props: { a: string }; someMethod: (a: number) => void }
}

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
// const aaa = test2(aa)

// declare function extraPropsOptional<T, Props, PropNames extends string>(
//   o: T & {
//     props?: PropNames[] | Props
//   }
// ): ComponentPropsWithDefaultOptional<T, Props>

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
  o: ComponentDefineOptions<
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
  ComponentDefineOptions<
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
