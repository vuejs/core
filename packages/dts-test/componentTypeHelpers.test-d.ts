import { expectType, describe } from './utils'

import {
  ExtractComponentOptions,
  ExtractComponentSlots,
  ExtractComponentEmits,
  defineComponent,
  defineAsyncComponent
} from 'vue'

declare function extractComponentOptions<T>(comp: T): ExtractComponentOptions<T>

declare function extractComponentSlots<T>(comp: T): ExtractComponentSlots<T>
describe('Extract Component Options', () => {
  describe('defineComponent', () => {
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
    // Component with props
    const CompProps = defineComponent(propsOptions)
    expectType<ExtractComponentOptions<typeof CompProps>>(propsOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof CompProps>>({ bar: 'foo' })

    // component array props
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
    }
    const CompPropsArray = defineComponent(arrayOptions)
    expectType<ExtractComponentOptions<typeof CompPropsArray>>(arrayOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof CompPropsArray>>({ bar: 'foo' })

    // component no props
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
    const CompNoProps = defineComponent(noPropsOptions)
    expectType<ExtractComponentOptions<typeof CompNoProps>>(noPropsOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof CompNoProps>>({ bar: 'foo' })
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

    // Component with props
    expectType<ExtractComponentOptions<typeof propsOptions>>(propsOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof propsOptions>>({ bar: 'foo' })

    // component array props
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
    }
    expectType<ExtractComponentOptions<typeof arrayOptions>>(arrayOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof arrayOptions>>({ bar: 'foo' })

    // component no props
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
    expectType<ExtractComponentOptions<typeof noPropsOptions>>(noPropsOptions)
    // @ts-expect-error checking if is not any
    expectType<ExtractComponentOptions<typeof noPropsOptions>>({ bar: 'foo' })
  })
})
