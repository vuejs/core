import {
  type ComponentInstance,
  type ComponentPublicInstance,
  type FunctionalComponent,
  defineComponent,
  ref,
} from 'vue'
import { describe, expectAssignable, expectType } from './utils'

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

  expectType(compSetup.test, {} as string | undefined)
  expectType(compSetup.a, {} as number)
  expectAssignable<ComponentPublicInstance>(compSetup)
})
describe('functional component', () => {
  // Functional
  const CompFunctional: FunctionalComponent<{ test?: string }> = {} as any
  const compFunctional: ComponentInstance<typeof CompFunctional> = {} as any

  expectType(compFunctional.test, {} as string | undefined)
  expectAssignable<ComponentPublicInstance>(compFunctional)

  const CompFunction: (props: { test?: string }) => any = {} as any
  const compFunction: ComponentInstance<typeof CompFunction> = {} as any

  expectType(compFunction.test, {} as string | undefined)
  expectAssignable<ComponentPublicInstance>(compFunction)
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
  expectType(compOptions.test, {} as string | undefined)
  expectType(compOptions.a, {} as number)
  expectAssignable<(a: string) => boolean>(compOptions.func)
  expectAssignable<ComponentPublicInstance>(compOptions)
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
  expectAssignable<string | undefined>(compObjectSetup.test)
  expectType(compObjectSetup.a, {} as number)
  expectAssignable<ComponentPublicInstance>(compObjectSetup)

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
  expectAssignable<string | undefined>(compObjectData.test)
  expectType(compObjectData.a, {} as number)
  expectAssignable<ComponentPublicInstance>(compObjectData)

  const CompObjectNoProps = {
    data() {
      return {
        a: 1,
      }
    },
  }
  const compObjectNoProps: ComponentInstance<typeof CompObjectNoProps> =
    {} as any
  expectAssignable<string | undefined>(compObjectNoProps.test)
  expectType(compObjectNoProps.a, {} as number)
  expectAssignable<ComponentPublicInstance>(compObjectNoProps)
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
  expectType(comp.msg, {} as string | number)
  expectType(comp.list, {} as Array<string | number>)
})

// #12751
{
  const Comp = defineComponent({
    __typeEmits: {} as {
      'update:visible': [value?: boolean]
    },
  })
  const comp: ComponentInstance<typeof Comp> = {} as any

  expectType(
    comp['onUpdate:visible'],
    {} as ((value?: boolean) => any) | undefined,
  )
  expectAssignable<{ 'onUpdate:visible'?: (value?: boolean) => any }>(
    comp['$props'],
  )
  // @ts-expect-error
  comp['$props']['$props']
}
