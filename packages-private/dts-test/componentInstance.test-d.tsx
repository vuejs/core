import {
  type AllowedComponentProps,
  type ComponentCustomProps,
  type ComponentInstance,
  type ComponentPublicInstance,
  type FunctionalComponent,
  type ShallowUnwrapRef,
  type VNode,
  type VNodeProps,
  defineComponent,
  ref,
} from 'vue'
import { type IsAny, describe, expectType } from './utils'

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
  const compSetup: ComponentInstance<typeof CompSetup> = {} as any

  expectType<string | undefined>(compSetup.test)
  expectType<number>(compSetup.a)
  expectType<ComponentPublicInstance>(compSetup)
})
describe('functional component', () => {
  // Functional
  const CompFunctional: FunctionalComponent<{ test?: string }> = {} as any
  const compFunctional: ComponentInstance<typeof CompFunctional> = {} as any

  expectType<string | undefined>(compFunctional.test)
  expectType<ComponentPublicInstance>(compFunctional)

  const CompFunction: (props: { test?: string }) => any = {} as any
  const compFunction: ComponentInstance<typeof CompFunction> = {} as any

  expectType<string | undefined>(compFunction.test)
  expectType<ComponentPublicInstance>(compFunction)
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

// #12751
{
  const Comp = defineComponent({
    __typeEmits: {} as {
      'update:visible': [value?: boolean]
    },
  })
  const comp: ComponentInstance<typeof Comp> = {} as any

  expectType<((value?: boolean) => any) | undefined>(comp['onUpdate:visible'])
  expectType<{ 'onUpdate:visible'?: (value?: boolean) => any }>(comp['$props'])
  // @ts-expect-error
  comp['$props']['$props']
}

// #12210
{
  const GenericComp: <T>(
    __VLS_props: {
      msg: T
      onFoo?: (val: T) => void
    } & VNodeProps &
      AllowedComponentProps &
      ComponentCustomProps,
    __VLS_ctx?: {
      attrs: any
      slots: {
        anySlot: (props: { item: T }) => any
      }
      emit: (evt: 'foo', val: T) => void
    },
    __VLS_expose?: (exposed: ShallowUnwrapRef<{}>) => void,
    __VLS_setup?: Promise<any>,
  ) => VNode = {} as any

  const comp: ComponentInstance<typeof GenericComp<string>> = {} as any
  expectType<string>(comp.msg)
  expectType<((val: string) => void) | undefined>(comp.onFoo)
  expectType<ComponentPublicInstance>(comp)
  expectType<false>({} as IsAny<typeof comp>)
  // @ts-expect-error
  comp.nonExistent

  const compUninstantiated: ComponentInstance<typeof GenericComp> = {} as any
  expectType<unknown>(compUninstantiated.msg)
  expectType<ComponentPublicInstance>(compUninstantiated)
  expectType<false>({} as IsAny<typeof compUninstantiated>)

  const CompFunctionalSlots: FunctionalComponent<
    { test?: string },
    { foo: [val: number] },
    { default: () => any }
  > = {} as any
  const compFunctionalSlots: ComponentInstance<typeof CompFunctionalSlots> =
    {} as any
  expectType<string | undefined>(compFunctionalSlots.test)
  expectType<(event: 'foo', val: number) => void>(compFunctionalSlots.$emit)
  expectType<false>({} as IsAny<typeof compFunctionalSlots>)

  type InvalidFn = (props: { a: string }, ctx: number) => any
  expectType<never>({} as ComponentInstance<InvalidFn>)

  type InvalidSlotsFn = (
    props: { a: string },
    ctx: {
      attrs: Record<string, unknown>
      emit: (event: string) => void
      slots: number
    },
  ) => VNode
  expectType<never>({} as ComponentInstance<InvalidSlotsFn>)
}
