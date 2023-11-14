import { expectType, describe } from './utils'

import {
  ExtractComponentOptions,
  ComponentProps,
  defineComponent,
  defineAsyncComponent
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
})
