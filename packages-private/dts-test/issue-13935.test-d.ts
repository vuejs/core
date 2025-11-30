import { defineEmits } from 'vue'
import { describe } from './utils'

describe('defineEmits w/ type declaration (Issue #13935)', () => {
  const emit = defineEmits<{
    open: [payload: number]
    close: [payload: string]
  }>()

  // Correct usages
  emit('open', 123)
  emit('close', 'abc')

  // Incorrect usages (should fail type check)
  // @ts-expect-error
  emit('open', 'string')
  // @ts-expect-error
  emit('close', 123)
  // @ts-expect-error
  emit('unknown', 123)
})
