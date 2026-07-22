import { createApp } from 'vue'
import { expectType } from './utils'

const app = createApp({})

app.directive<HTMLElement, string, 'prevent' | 'stop', 'arg1' | 'arg2'>(
  'custom',
  {
    mounted(el, binding) {
      expectType(el, {} as HTMLElement)
      expectType(binding.value, {} as string)
      expectType(binding.modifiers, {} as { prevent?: boolean; stop?: boolean })
      expectType(binding.arg, {} as 'arg1' | 'arg2' | undefined)
    },
  },
)
