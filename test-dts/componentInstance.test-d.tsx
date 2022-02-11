import {
  defineComponent,
  expectType,
  FunctionalComponent,
  ComponentPublicInstance,
  ComponentInstance
} from './index'

const CompSetup = defineComponent({
  props: {
    test: String
  },
  setup() {
    return {
      a: 1
    }
  }
})
declare const compSetup: ComponentInstance<typeof CompSetup>

expectType<string | undefined>(compSetup.test)
expectType<number>(compSetup.a)
expectType<ComponentPublicInstance>(compSetup)

// Functional
declare const CompFunctional: FunctionalComponent<{ test?: string }>
declare const compFunctional: ComponentInstance<typeof CompFunctional>

expectType<string | undefined>(compFunctional.test)
expectType<ComponentPublicInstance>(compFunctional)

declare const CompFunction: (props: { test?: string }) => any
declare const compFunction: ComponentInstance<typeof CompFunction>

expectType<string | undefined>(compFunction.test)
expectType<ComponentPublicInstance>(compFunction)

// Options
const CompOptions = defineComponent({
  props: {
    test: String
  },
  data() {
    return {
      a: 1
    }
  },
  computed: {
    b() {
      return 'test'
    }
  },
  methods: {
    func(a: string) {
      return true
    }
  }
})
declare const compOptions: ComponentInstance<typeof CompOptions>
expectType<string | undefined>(compOptions.test)
expectType<number>(compOptions.a)
expectType<(a: string) => boolean>(compOptions.func)
expectType<ComponentPublicInstance>(compOptions)

// object - no defineComponent

const CompObjectSetup = {
  props: {
    test: String
  },
  setup() {
    return {
      a: 1
    }
  }
}
declare const compObjectSetup: ComponentInstance<typeof CompObjectSetup>
expectType<string | undefined>(compObjectSetup.test)
expectType<number>(compObjectSetup.a)
expectType<ComponentPublicInstance>(compObjectSetup)

const CompObjectData = {
  props: {
    test: String
  },
  data() {
    return {
      a: 1
    }
  }
}
declare const compObjectData: ComponentInstance<typeof CompObjectData>
expectType<string | undefined>(compObjectData.test)
expectType<number>(compObjectData.a)
expectType<ComponentPublicInstance>(compObjectData)

const CompObjectNoProps = {
  data() {
    return {
      a: 1
    }
  }
}
declare const compObjectNoProps: ComponentInstance<typeof CompObjectNoProps>
expectType<string | undefined>(compObjectNoProps.test)
expectType<number>(compObjectNoProps.a)
expectType<ComponentPublicInstance>(compObjectNoProps)
