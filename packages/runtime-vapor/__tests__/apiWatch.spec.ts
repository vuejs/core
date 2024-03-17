import type { Ref } from '@vue/reactivity'
import {
  EffectScope,
  nextTick,
  onWatcherCleanup,
  ref,
  watchEffect,
  watchSyncEffect,
} from '../src'

describe('watchEffect and onWatcherCleanup', () => {
  test('basic', async () => {
    let dummy = 0
    let source: Ref<number>
    const scope = new EffectScope()

    scope.run(() => {
      source = ref(0)
      watchEffect(onCleanup => {
        source.value

        onCleanup(() => (dummy += 2))
        onWatcherCleanup(() => (dummy += 3))
        onWatcherCleanup(() => (dummy += 5))
      })
    })
    await nextTick()
    expect(dummy).toBe(0)

    scope.run(() => {
      source.value++
    })
    await nextTick()
    expect(dummy).toBe(10)

    scope.run(() => {
      source.value++
    })
    await nextTick()
    expect(dummy).toBe(20)

    scope.stop()
    await nextTick()
    expect(dummy).toBe(30)
  })

  test('nested call to watchEffect', async () => {
    let dummy = 0
    let source: Ref<number>
    let double: Ref<number>
    const scope = new EffectScope()

    scope.run(() => {
      source = ref(0)
      double = ref(0)
      watchEffect(() => {
        double.value = source.value * 2
        onWatcherCleanup(() => (dummy += 2))
      })
      watchSyncEffect(() => {
        double.value
        onWatcherCleanup(() => (dummy += 3))
      })
    })
    await nextTick()
    expect(dummy).toBe(0)

    scope.run(() => source.value++)
    await nextTick()
    expect(dummy).toBe(5)

    scope.run(() => source.value++)
    await nextTick()
    expect(dummy).toBe(10)

    scope.stop()
    await nextTick()
    expect(dummy).toBe(15)
  })
})
