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
  it.skip('should release computed cache', async () => {
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

  it.skip('should release reactive property dep', async () => {
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
})
