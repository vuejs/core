import {
  ComputedRef,
  computed,
  effect,
  shallowRef as ref,
  stop
} from '../src/index'

describe('reactivity/gc', () => {
  const gc = () => {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        global.gc!()
        resolve()
      })
    })
  }

  it('should enabled --expose-gc', () => {
    expect(global.gc).not.toBeUndefined()
  })

  // #9233
  it('should release computed cache', async () => {
    const src = ref<{} | undefined>({})
    const srcRef = new WeakRef(src.value!)

    let c: ComputedRef | undefined = computed(() => src.value)

    c.value // cache src value
    src.value = undefined // release value
    c = undefined // release computed

    await gc()
    expect(srcRef.deref()).toBeUndefined()
  })

  it('should not release effect', async () => {
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
})
