import { nextTick, ref, watch, watchEffect } from '../src'
import { test } from '../../../scripts/bench'

test('create watcher', async ({ benchmark }) => {
  await benchmark(() => {
    const v = ref(100)
    watch(v, v => {})
  })
})

{
  const v = ref(100)
  watch(v, v => {})
  let i = 0
  test('update ref to trigger watcher (scheduled but not executed)', async ({
    benchmark,
  }) => {
    await benchmark(() => {
      v.value = i++
    })
  })
}

{
  const v = ref(100)
  watch(v, v => {})
  let i = 0
  test('update ref to trigger watcher (executed)', async ({ benchmark }) => {
    await benchmark(async () => {
      v.value = i++
      return nextTick()
    })
  })
}

{
  test('create watchEffect', async ({ benchmark }) => {
    await benchmark(() => {
      watchEffect(() => {})
    })
  })
}

{
  const v = ref(100)
  watchEffect(() => {
    v.value
  })
  let i = 0
  test('update ref to trigger watchEffect (scheduled but not executed)', async ({
    benchmark,
  }) => {
    await benchmark(() => {
      v.value = i++
    })
  })
}

{
  const v = ref(100)
  watchEffect(() => {
    v.value
  })
  let i = 0
  test('update ref to trigger watchEffect (executed)', async ({
    benchmark,
  }) => {
    await benchmark(async () => {
      v.value = i++
      await nextTick()
    })
  })
}
