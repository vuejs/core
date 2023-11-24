import {
  DeclareComponent,
  DefineComponent,
  ExtractComponentEmitOptions,
  defineComponent,
  h
} from 'vue'
import { expectType } from './utils'
import { SlotsType } from 'vue'
import { EmitsToProps } from 'packages/runtime-core/src/componentEmits'

declare module 'vue' {
  interface ComponentCustomOptions {
    test?(n: number): void
  }

  interface ComponentCustomProperties {
    state?: 'stopped' | 'running'
  }

  interface ComponentCustomProps {
    custom?: number
  }
}

export const Custom = defineComponent({
  props: {
    bar: String,
    baz: {
      type: Number,
      required: true
    }
  },

  data: () => ({ counter: 0 }),

  test(n) {
    expectType<number>(n)
  },

  methods: {
    aMethod() {
      this.counter++
      this.state = 'running'
      this.$.appContext.config.globalProperties.state = 'running'

      // @ts-expect-error
      this.notExisting
      // @ts-expect-error
      this.state = 'not valid'
      // @ts-expect-error
      this.$.appContext.config.globalProperties.state = 'not valid'
    }
  }
})

expectType<JSX.Element>(<Custom baz={1} />)
expectType<JSX.Element>(<Custom custom={1} baz={1} />)
expectType<JSX.Element>(<Custom bar="bar" baz={1} />)
expectType<JSX.Element>(<Custom ref={''} bar="bar" baz={1} />)

// @ts-expect-error
expectType<JSX.Element>(<Custom />)
// @ts-expect-error
;<Custom bar="bar" />
// @ts-expect-error
;<Custom baz="baz" />
// @ts-expect-error
;<Custom baz={1} notExist={1} />
// @ts-expect-error
;<Custom baz={1} custom="custom" />

type ErrorLevel = 'debug' | 'warning' | 'error'

declare function ErrorComponent<T>(options: T): T &
  DeclareComponent<{
    new <T extends ErrorLevel = 'debug'>(): {
      $props: { type: T } & EmitsToProps<{
        [K in `on${Capitalize<T>}`]: (msg: string) => void
      }>
      $slots: SlotsType<Record<T, (msg: string) => any[]>>
    }
  }>

const Comp = ErrorComponent(
  defineComponent({
    props: {
      type: {
        type: String as () => ErrorLevel,
        default: 'debug'
      }
    },
    emits: ['debug', 'warning', 'error']
  })
)
;<Comp type="debug" onDebug={() => {}} />
// @ts-expect-error onError is not there
;<Comp type="debug" onError={v => {}} />
