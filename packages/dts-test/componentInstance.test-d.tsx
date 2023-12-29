import {
  type ComponentInstance,
  type ComponentPublicInstance,
  type FunctionalComponent,
  defineComponent,
  ref,
} from 'vue'
import { describe, expectType } from './utils'

declare function getComponentInstance<T>(comp: T): ComponentInstance<T>

describe('defineComponent', () => {
  const CompSetup = defineComponent({
    props: {
      test: String,
    },
    setup() {
      return {
        a: 1,
      }
    },
  })
  const compSetup = getComponentInstance(CompSetup)

  expectType<string | undefined>(compSetup.test)
  expectType<number>(compSetup.a)
  expectType<ComponentPublicInstance>(compSetup)

  describe('ComponentInstance is ComponentPublicInstance', () => {
    const EmptyObj = getComponentInstance(defineComponent({}))
    expectType<ComponentPublicInstance>(EmptyObj)
    //@ts-expect-error not valid
    expectType<{ error: true }>(EmptyObj)

    const EmptyPropsObj = getComponentInstance(
      defineComponent({
        props: {},
      }),
    )
    expectType<ComponentPublicInstance>(EmptyPropsObj)
    //@ts-expect-error not valid
    expectType<{ error: true }>(EmptyPropsObj)
    //@ts-expect-error not valid
    expectType<{ a?: any }>(EmptyPropsObj.$props)

    const EmptyArrayPropsObj = getComponentInstance(
      defineComponent({
        props: [],
      }),
    )
    expectType<ComponentPublicInstance>(EmptyArrayPropsObj)
    //@ts-expect-error not valid
    expectType<{ error: true }>(EmptyArrayPropsObj)
    //@ts-expect-error not valid
    expectType<{ a?: any }>(EmptyArrayPropsObj.$props)

    const ArrayPropsStringObj = getComponentInstance(
      defineComponent({
        props: [] as string[],
      }),
    )
    expectType<ComponentPublicInstance>(ArrayPropsStringObj)
    //@ts-expect-error not valid
    expectType<{ error: true }>(ArrayPropsStringObj)
    // props could not be resolved
    expectType<{ a?: any }>(ArrayPropsStringObj.$props)

    const PropsObject = getComponentInstance(
      defineComponent({
        props: {
          a: String,
        },
      }),
    )
    //@ts-expect-error not valid
    expectType<{ error: true }>(PropsObject)
    expectType<ComponentPublicInstance>(PropsObject)
    expectType<{ a?: string | undefined }>(PropsObject.$props)
    expectType<{
      a: StringConstructor
    }>(PropsObject.$options.props)
    //@ts-expect-error not valid
    expectType<{ __a?: any }>(PropsObject.$props)

    const PropsArray = getComponentInstance(
      defineComponent({
        props: ['a'],
      }),
    )
    //@ts-expect-error not valid
    expectType<{ error: true }>(PropsArray)

    expectType<ComponentPublicInstance>(PropsArray)
    expectType<{ a?: any }>(PropsArray.$props)
    expectType<'a'[]>(PropsArray.$options.props)
    //@ts-expect-error not valid
    expectType<{ __a?: any }>(PropsArray.$props)

    const EmitsArray = getComponentInstance(
      defineComponent({
        emits: ['a'],
      }),
    )
    //@ts-expect-error not valid
    expectType<{ error: true }>(EmitsArray)

    expectType<ComponentPublicInstance>(EmitsArray)
    expectType<(event: 'a', ...args: any[]) => void>(EmitsArray.$emit)
    expectType<'a'[]>(EmitsArray.$options.emits)
    //@ts-expect-error not valid
    expectType<{ __a?: any }>(EmitsArray.$options.emits)
    //@ts-expect-error not valid
    expectType<{ __a?: any }>(EmitsArray.$emit)

    const EmitsArrayCast = getComponentInstance(
      defineComponent({
        emits: ['a'] as ['a'],
      }),
    )
    //@ts-expect-error not valid
    expectType<{ error: true }>(EmitsArrayCast)

    expectType<ComponentPublicInstance>(EmitsArrayCast)
    expectType<(event: 'a', ...args: any[]) => void>(EmitsArrayCast.$emit)
    expectType<['a']>(EmitsArrayCast.$options.emits)
    //@ts-expect-error not valid
    expectType<{ __a?: any }>(EmitsArrayCast.$options.emits)
    //@ts-expect-error not valid
    expectType<{ __a?: any }>(EmitsArrayCast.$emit)

    const EmitsOptions = getComponentInstance(
      defineComponent({
        emits: {
          foo: (a: string) => true,
        },
      }),
    )

    //@ts-expect-error not valid
    expectType<{ error: true }>(EmitsOptions)
    expectType<ComponentPublicInstance>(EmitsOptions)

    expectType<(event: 'foo', a: string) => void>(EmitsOptions.$emit)
    expectType<{
      foo: (a: string) => true
    }>(EmitsOptions.$options.emits)
    //@ts-expect-error not valid
    expectType<{ __a?: any }>(EmitsOptions.$options.emits)
    //@ts-expect-error not valid
    expectType<{ __a?: any }>(EmitsOptions.$emit)

    // full Component

    const MixinFoo = defineComponent({
      props: {
        foo: { type: String, required: true },
      },
      data() {
        return {
          fooExtra: 'foo',
        }
      },
      methods: {
        fooMethod() {
          return true
        },
      },
      computed: {
        fooComputed() {
          return 'fooX'
        },
      },
    })
    const MixinBar = defineComponent({
      props: ['bar'],
    })

    const fullComponent = getComponentInstance(
      defineComponent({
        props: {
          a: String,
        },
        mixins: [MixinFoo, MixinBar],

        randomOption: true,

        data() {
          return {
            b: 1,
          }
        },

        setup() {
          return {
            c: 1,
          }
        },

        methods: {
          testMethod(r: number) {
            return this.bar + r
          },
        },
        computed: {
          testComputed() {
            return `${this.a}:${this.b}`
          },
        },
      }),
    )
    expectType<ComponentPublicInstance>(fullComponent)

    //@ts-expect-error not valid
    expectType<{ error: true }>(fullComponent)

    expectType<{ a?: string | undefined; bar?: any; foo: string }>(
      fullComponent.$props,
    )
    expectType<{ b: number; fooExtra: string }>(fullComponent.$data)

    //@ts-expect-error not valid
    expectType<{ __a?: any }>(fullComponent.$options.props)
    //@ts-expect-error not valid
    expectType<{ __a?: any }>(fullComponent.$props)
    //@ts-expect-error not valid
    expectType<{ __a?: any }>(fullComponent.$emit)

    //TODO This should not be valid
    expectType<{ __a?: any }>(fullComponent.$options.emits)

    expectType<{
      fooMethod(): boolean
      testMethod(r: number): any

      fooComputed: string
      testComputed: string

      c: number
      b: number
    }>(fullComponent)

    expectType<{
      props: {
        a: StringConstructor
      }
      randomOption: boolean

      methods: {
        testMethod(r: number): any
      }
      computed: {
        testComputed: any
      }

      mixins: Array<typeof MixinFoo | typeof MixinBar>

      setup: () => { c: number }
    }>(fullComponent.$options)
  })
})
describe('functional component', () => {
  // Functional
  const CompFunctional: FunctionalComponent<{ test?: string }> = {} as any
  const compFunctional = getComponentInstance(CompFunctional)

  expectType<string | undefined>(compFunctional.test)
  expectType<ComponentPublicInstance>(compFunctional)

  const CompFunction: (props: { test?: string }) => any = {} as any
  const compFunction = getComponentInstance(CompFunction)

  expectType<string | undefined>(compFunction.test)
  expectType<ComponentPublicInstance>(compFunction)

  const CompDefineFunction = defineComponent(
    (props: { test?: string }) => () => {},
  )
  const compDefineFunction = getComponentInstance(CompDefineFunction)

  expectType<string | undefined>(compDefineFunction.test)
  expectType<ComponentPublicInstance>(compDefineFunction)
})

describe('options component', () => {
  // Options
  const CompOptions = defineComponent({
    props: {
      test: String,
    },
    data() {
      return {
        a: 1,
      }
    },
    computed: {
      b() {
        return 'test'
      },
    },
    methods: {
      func(a: string) {
        return true
      },
    },
  })
  const compOptions: ComponentInstance<typeof CompOptions> = {} as any
  expectType<string | undefined>(compOptions.test)
  expectType<number>(compOptions.a)
  expectType<(a: string) => boolean>(compOptions.func)
  expectType<ComponentPublicInstance>(compOptions)

  describe('ComponentInstance is ComponentPublicInstance', () => {
    const EmptyObj = getComponentInstance({})
    expectType<ComponentPublicInstance>(EmptyObj)
    //@ts-expect-error not valid
    expectType<{ error: true }>(EmptyObj)

    const EmptyPropsObj = getComponentInstance({
      props: {},
    })
    expectType<ComponentPublicInstance>(EmptyPropsObj)
    //@ts-expect-error not valid
    expectType<{ error: true }>(EmptyPropsObj)
    //@ts-expect-error not valid
    expectType<{ a?: any }>(EmptyPropsObj.$props)

    const EmptyArrayPropsObj = getComponentInstance({
      props: [],
    })
    expectType<ComponentPublicInstance>(EmptyArrayPropsObj)
    //@ts-expect-error not valid
    expectType<{ error: true }>(EmptyArrayPropsObj)
    //@ts-expect-error not valid
    expectType<{ a?: any }>(EmptyArrayPropsObj.$props)

    const ArrayPropsStringObj = getComponentInstance({
      props: [] as string[],
    })
    expectType<ComponentPublicInstance>(ArrayPropsStringObj)
    //@ts-expect-error not valid
    expectType<{ error: true }>(ArrayPropsStringObj)
    // props could not be resolved
    expectType<{ a?: any }>(ArrayPropsStringObj.$props)

    const PropsObject = getComponentInstance({
      props: {
        a: String,
      },
    })
    //@ts-expect-error not valid
    expectType<{ error: true }>(PropsObject)
    expectType<ComponentPublicInstance>(PropsObject)
    expectType<{ a?: string | undefined }>(PropsObject.$props)
    expectType<{
      a: StringConstructor
    }>(PropsObject.$options.props)

    const PropsArray = getComponentInstance({
      props: ['a'] as ['a'],
    })
    //@ts-expect-error not valid
    expectType<{ error: true }>(PropsArray)

    expectType<ComponentPublicInstance>(PropsArray)
    expectType<{ a?: any }>(PropsArray.$props)
    expectType<'a'[]>(PropsArray.$options.props)

    const EmitsArray = getComponentInstance({
      emits: ['a'] as ['a'],
    })
    //@ts-expect-error not valid
    expectType<{ error: true }>(EmitsArray)

    expectType<ComponentPublicInstance>(EmitsArray)
    expectType<(event: 'a', ...args: any[]) => void>(EmitsArray.$emit)
    expectType<'a'[]>(EmitsArray.$options.emits)

    const EmitsArrayCast = getComponentInstance({
      emits: ['a'] as ['a'],
    })
    //@ts-expect-error not valid
    expectType<{ error: true }>(EmitsArrayCast)

    expectType<ComponentPublicInstance>(EmitsArrayCast)
    expectType<(event: 'a', ...args: any[]) => void>(EmitsArrayCast.$emit)
    expectType<['a']>(EmitsArrayCast.$options.emits)

    const EmitsOptions = getComponentInstance({
      emits: {
        foo: (a: string) => true,
      },
    })

    //@ts-expect-error not valid
    expectType<{ error: true }>(EmitsOptions)
    expectType<ComponentPublicInstance>(EmitsOptions)

    expectType<(event: 'foo', a: string) => void>(EmitsOptions.$emit)
    expectType<{
      foo: (a: string) => true
    }>(EmitsOptions.$options.emits)

    // full Component

    const MixinFoo = defineComponent({
      props: {
        foo: { type: String, required: true },
      },
      data() {
        return {
          fooExtra: 'foo',
        }
      },
      methods: {
        fooMethod() {
          return true
        },
      },
      computed: {
        fooComputed() {
          return 'fooX'
        },
      },
    })
    const MixinBar = defineComponent({
      props: ['bar'],
    })

    const fullComponent = getComponentInstance({
      props: {
        a: String,
      },
      mixins: [MixinFoo, MixinBar],

      randomOption: true,

      data() {
        return {
          b: 1,
        }
      },

      methods: {
        // @ts-expect-error cannot infer this, using `defineComponent`
        testMethod(r: number) {
          // @ts-expect-error cannot infer this, using `defineComponent`
          return this.bar + r
        },
      },
      computed: {
        // @ts-expect-error cannot infer this, using `defineComponent`
        testComputed() {
          // @ts-expect-error cannot infer this, using `defineComponent`
          return `${this.a}:${this.b}`
        },
      },
    })
    expectType<ComponentPublicInstance>(fullComponent)

    //@ts-expect-error not valid
    expectType<{ error: true }>(fullComponent)

    expectType<{ a?: string | undefined; bar?: any; foo: string }>(
      fullComponent.$props,
    )
    expectType<{ b: number; fooExtra: string }>(fullComponent.$data)

    expectType<{
      fooMethod(): boolean
      testMethod(r: number): any

      fooComputed: string
      testComputed: string
    }>(fullComponent)

    expectType<{
      props: {
        a: StringConstructor
      }
      randomOption: boolean

      methods: {
        testMethod(r: number): any
      }
      computed: {
        testComputed: any
      }

      mixins: Array<typeof MixinFoo | typeof MixinBar>
    }>(fullComponent.$options)
  })
})

describe('object no defineComponent', () => {
  // object - no defineComponent

  const CompObjectSetup = {
    props: {
      test: String,
    },
    setup() {
      return {
        a: 1,
      }
    },
  }
  const compObjectSetup: ComponentInstance<typeof CompObjectSetup> = {} as any
  expectType<string | undefined>(compObjectSetup.test)
  expectType<number>(compObjectSetup.a)
  expectType<ComponentPublicInstance>(compObjectSetup)

  const CompObjectData = {
    props: {
      test: String,
    },
    data() {
      return {
        a: 1,
      }
    },
  }
  const compObjectData: ComponentInstance<typeof CompObjectData> = {} as any
  expectType<string | undefined>(compObjectData.test)
  expectType<number>(compObjectData.a)
  expectType<ComponentPublicInstance>(compObjectData)

  const CompObjectNoProps = {
    data() {
      return {
        a: 1,
      }
    },
  }
  const compObjectNoProps: ComponentInstance<typeof CompObjectNoProps> =
    {} as any
  expectType<string | undefined>(compObjectNoProps.test)
  expectType<number>(compObjectNoProps.a)
  expectType<ComponentPublicInstance>(compObjectNoProps)
})

describe('Generic component', () => {
  const Comp = defineComponent(
    // TODO: babel plugin to auto infer runtime props options from type
    // similar to defineProps<{...}>()
    <T extends string | number>(props: { msg: T; list: T[] }) => {
      // use Composition API here like in <script setup>
      const count = ref(0)

      return () => (
        // return a render function (both JSX and h() works)
        <div>
          {props.msg} {count.value}
        </div>
      )
    },
  )

  // defaults to known types since types are resolved on instantiation
  const comp: ComponentInstance<typeof Comp> = {} as any
  expectType<string | number>(comp.msg)
  expectType<Array<string | number>>(comp.list)
})
