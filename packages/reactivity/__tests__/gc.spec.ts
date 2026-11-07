import {
  type ComputedRef,
  computed,
  effect,
  effectScope,
  reactive,
  shallowRef as ref,
  toRaw,
} from '../src/index'
import { getDepFromReactive } from '../src/dep'

describe.skipIf(!global.gc)('reactivity/gc', () => {
  const gc = () => {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        global.gc!()
        resolve()
      })
    })
  }

  // #9233
  it.todo('should release computed cache', async () => {
    const src = ref<{} | undefined>({})
    // @ts-expect-error ES2021 API
    const srcRef = new WeakRef(src.value!)

    let c: ComputedRef | undefined = computed(() => src.value)

    c.value // cache src value
    src.value = undefined // release value
    c = undefined // release computed

    await gc()
    expect(srcRef.deref()).toBeUndefined()
  })

  it.todo('should release reactive property dep', async () => {
    const src = reactive({ foo: 1 })

    let c: ComputedRef | undefined = computed(() => src.foo)

    c.value
    expect(getDepFromReactive(toRaw(src), 'foo')).not.toBeUndefined()

    c = undefined
    await gc()
    await gc()
    expect(getDepFromReactive(toRaw(src), 'foo')).toBeUndefined()
  })

  it('should not release effect for ref', async () => {
    const spy = vi.fn()
    const src = ref(0)

    effect(() => {
      spy()
      src.value
    })

    expect(spy).toHaveBeenCalledTimes(1)

    await gc()
    src.value++
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('should not release effect for reactive', async () => {
    const spy = vi.fn()
    const src = reactive({ foo: 1 })

    effect(() => {
      spy()
      src.foo
    })

    expect(spy).toHaveBeenCalledTimes(1)

    await gc()
    src.foo++
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('should release computed that untrack by effect', async () => {
    const src = ref(0)
    // @ts-expect-error ES2021 API
    const c = new WeakRef(computed(() => src.value))
    const scope = effectScope()

    scope.run(() => {
      effect(() => c.deref().value)
    })

    expect(c.deref()).toBeDefined()
    scope.stop()
    await gc()
    expect(c.deref()).toBeUndefined()
  })

  it('should release computed that untrack by effectScope', async () => {
    const src = ref(0)
    // @ts-expect-error ES2021 API
    const c = new WeakRef(computed(() => src.value))
    const scope = effectScope()

    scope.run(() => {
      c.deref().value
    })

    expect(c.deref()).toBeDefined()
    scope.stop()
    await gc()
    expect(c.deref()).toBeUndefined()
  })

  it('should release stopped effects across minor collections during subscriber churn', async ({
    skip,
  }) => {
    const minorGC = () =>
      new Promise<void>(resolve => {
        setTimeout(() => {
          global.gc!({ type: 'minor' })
          resolve()
        })
      })
    // Some V8 versions treat WeakRef targets as strong during minor GC.
    // @ts-expect-error ES2021 API
    const probe = new WeakRef({})
    await minorGC()
    if (probe.deref() !== undefined) {
      skip('This runtime keeps WeakRef targets alive during minor GC')
    }

    const source = ref(0)
    const live = Array.from({ length: 32 }, () => effect(() => source.value))
    // Promote the initial links so stale pointers from them would keep younger
    // effects alive even after those effects are stopped.
    await gc()

    const payloads = Array.from({ length: 256 }, (_, value) => {
      const payload = { value }
      live.push(effect(() => source.value + payload.value))
      live.shift()!.effect.stop()
      // @ts-expect-error ES2021 API
      return new WeakRef(payload)
    })

    // WeakRef targets are kept alive until the end of the current job. Collect
    // in a new task, without a major GC that would also reclaim the old links.
    await minorGC()

    payloads.forEach((payload, index) => {
      if (index < payloads.length - live.length) {
        expect(payload.deref()).toBeUndefined()
      } else {
        expect(payload.deref()).toBeDefined()
      }
    })
    live.forEach(runner => runner.effect.stop())
  })
})
