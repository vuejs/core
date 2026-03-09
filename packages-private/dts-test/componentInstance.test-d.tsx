import {
  type ComponentInstance,
  type ComponentPublicInstance,
  type FunctionalComponent,
  defineComponent,
  ref,
} from 'vue'
import { describe, expectType } from './utils'

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
