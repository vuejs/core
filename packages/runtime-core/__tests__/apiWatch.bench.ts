import { nextTick, ref, watch, watchEffect } from '../src'
import { bench } from 'vitest'

bench('create watcher', () => {
  const v = ref(100)
  watch(v, v => {})
})

{
  const v = ref(100)
  watch(v, v => {})
  let i = 0
  bench('update ref to trigger watcher (scheduled but not executed)', () => {
    v.value = i++
  })
}

{
  const v = ref(100)
  watch(v, v => {})
  let i = 0
  bench('update ref to trigger watcher (executed)', async () => {
    v.value = i++
    return nextTick()
  })
}

{
  bench('create watchEffect', () => {
    watchEffect(() => {})
  })
}

{
  const v = ref(100)
  watchEffect(() => {
    v.value
  })
  let i = 0
  bench(
    'update ref to trigger watchEffect (scheduled but not executed)',
    () => {
      v.value = i++
    },
  )
}

{
  const v = ref(100)
  watchEffect(() => {
    v.value
  })
  let i = 0
  bench('update ref to trigger watchEffect (executed)', async () => {
    v.value = i++
    await nextTick()
  })
}
