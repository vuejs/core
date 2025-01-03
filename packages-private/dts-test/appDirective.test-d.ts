import { createApp } from 'vue'
import { expectType } from './utils'

const app = createApp({})

app.directive<HTMLElement, string, 'prevent' | 'stop', 'arg1' | 'arg2'>(
  'custom',
  {
    mounted(el, binding) {
      expectType<HTMLElement>(el)
      expectType<string>(binding.value)
      expectType<{ prevent: boolean; stop: boolean }>(binding.modifiers)
      expectType<'arg1' | 'arg2'>(binding.arg!)

      // @ts-expect-error not any
      expectType<number>(binding.value)
    },
  },
)
