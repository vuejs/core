import { createApp } from 'vue'
import { expectType } from './utils'

const app = createApp({})

app.directive<HTMLElement, string>('custom', {
  mounted(el, binding) {
    expectType<HTMLElement>(el)
    expectType<string>(binding.value)

    // @ts-expect-error not any
    expectType<number>(binding.value)
  },
})
