import { expectType, describe } from './utils'

import {
  ExtractComponentOptions,
  ExtractComponentSlots,
  ComponentProps,
  ExtractComponentEmits,
  defineComponent,
  defineAsyncComponent
} from 'vue'

declare function extractComponentOptions<T>(comp: T): ExtractComponentOptions<T>

declare function extractComponentSlots<T>(comp: T): ExtractComponentSlots<T>

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
} as const

const arrayOptions = {
  props: ['a', 'b', 'c'],
  slots: {
    default(arg: { msg: string }) {}
  },
  foo: 'bar',
  data() {
    return {
      test: 1
    }
  }
} as const

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
} as const

const mixIn = {
  props: ['a1'],
  mixins: [propsOptions, arrayOptions, noPropsOptions]
} as const

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

    const Mixins = defineComponent(mixIn)
    expectType<ExtractComponentOptions<typeof Mixins>>(mixIn)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof Mixins>>(mixIn)
  })

  describe('async component', () => {
    const Component = defineAsyncComponent({
      loader: () =>
        Promise.resolve(
          defineComponent({
            foo: 'bar'
          })
        )
    })

    // NOTE not sure if this is the intention since Component.foo is undefined
    expectType<ExtractComponentOptions<typeof Component>>({
      foo: 'bar'
    })
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
})

describe('Component Props', () => {
  describe('defineComponent', () => {
    // Component with props
    const CompProps = defineComponent(propsOptions)
    const p = {} as ComponentProps<{
      props: ['a']

      emits: {
        foo: (a: { msg: string }) => true
      }
    }>

    if (p.a && p.onFoo) {
    }

    expectType<{
      readonly a?: string | undefined
      readonly b: boolean | undefined
      readonly bb: boolean
    }>({} as ComponentProps<typeof CompProps>)
    // @ts-expect-error checking if is not any
    expectType<{ bar: string }>({} as ComponentProps<typeof CompProps>)

    // component array props
    const CompPropsArray = defineComponent(arrayOptions)
    expectType<ComponentProps<typeof CompPropsArray>>(arrayOptions)

    // extractComponentOptions(CompPropsArray)
    const a = {} as ComponentProps<typeof CompPropsArray>
    // @ts-expect-error checking if is not any
    expectType<ComponentProps<typeof CompPropsArray>>({ bar: 'foo' })

    // component no props
    const CompNoProps = defineComponent(noPropsOptions)
    expectType<ComponentProps<typeof CompNoProps>>(noPropsOptions)
    // @ts-expect-error checking if is not any
    expectType<ComponentProps<typeof CompNoProps>>({ bar: 'foo' })
  })

  describe('async component', () => {
    const Component = defineAsyncComponent({
      loader: () =>
        Promise.resolve(
          defineComponent({
            foo: 'bar'
          })
        )
    })

    // NOTE not sure if this is the intention since Component.foo is undefined
    expectType<ComponentProps<typeof Component>>({
      foo: 'bar'
    })
  })

  describe('options object', () => {
    // Component with props
    expectType<ComponentProps<typeof propsOptions>>(propsOptions)
    // @ts-expect-error checking if is not any
    expectType<ComponentProps<typeof propsOptions>>({ bar: 'foo' })

    // component array props
    expectType<ComponentProps<typeof arrayOptions>>(arrayOptions)
    // @ts-expect-error checking if is not any
    expectType<ComponentProps<typeof arrayOptions>>({ bar: 'foo' })

    // component no props
    expectType<ComponentProps<typeof noPropsOptions>>(noPropsOptions)
    // @ts-expect-error checking if is not any
    expectType<ComponentProps<typeof noPropsOptions>>({ bar: 'foo' })
  })
})
