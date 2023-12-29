import { defineAsyncComponent } from 'vue'
import { expectType } from './utils'

defineAsyncComponent(async () => ({
  props: { n: Number },
  setup(props) {
    expectType<number | undefined>(props.n)

    // @ts-expect-error not any
    expectType<string>(props.n)
  },
}))
