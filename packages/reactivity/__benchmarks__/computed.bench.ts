import { bench, describe } from 'vitest'
import type { ComputedRef, Ref } from '../src'
import { computed, effect, ref } from '../dist/reactivity.esm-browser.prod'

declare module '../dist/reactivity.esm-browser.prod' {
  function computed(...args: any[]): any
}

describe('computed', () => {
  bench('create computed', () => {
    computed(() => 100)
  })

  {
    const v = ref(100)
    computed(() => v.value * 2)
    let i = 0
    bench("write ref, don't read computed (without effect)", () => {
      v.value = i++
    })
  }

  {
    const v = ref(100)
    const c = computed(() => {
      return v.value * 2
    })
    effect(() => c.value)
    let i = 0
    bench("write ref, don't read computed (with effect)", () => {
      v.value = i++
    })
  }

  {
    const v = ref(100)
    const c = computed(() => {
      return v.value * 2
    })
    let i = 0
    bench('write ref, read computed (without effect)', () => {
      v.value = i++
      c.value
    })
  }

  {
    const v = ref(100)
    const c = computed(() => {
      return v.value * 2
    })
    effect(() => c.value)
    let i = 0
    bench('write ref, read computed (with effect)', () => {
      v.value = i++
      c.value
    })
  }

  {
    const v = ref(100)
    const computeds: ComputedRef<number>[] = []
    for (let i = 0, n = 1000; i < n; i++) {
      const c = computed(() => {
        return v.value * 2
      })
      computeds.push(c)
    }
    let i = 0
    bench("write ref, don't read 1000 computeds (without effect)", () => {
      v.value = i++
    })
  }

  {
    const v = ref(100)
    const computeds: ComputedRef<number>[] = []
    for (let i = 0, n = 1000; i < n; i++) {
      const c = computed(() => {
        return v.value * 2
      })
      effect(() => c.value)
      computeds.push(c)
    }
    let i = 0
    bench(
      "write ref, don't read 1000 computeds (with multiple effects)",
      () => {
        v.value = i++
      },
    )
  }

  {
    const v = ref(100)
    const computeds: ComputedRef<number>[] = []
    for (let i = 0, n = 1000; i < n; i++) {
      const c = computed(() => {
        return v.value * 2
      })
      computeds.push(c)
    }
    effect(() => {
      for (let i = 0; i < 1000; i++) {
        computeds[i].value
      }
    })
    let i = 0
    bench("write ref, don't read 1000 computeds (with single effect)", () => {
      v.value = i++
    })
  }

  {
    const v = ref(100)
    const computeds: ComputedRef<number>[] = []
    for (let i = 0, n = 1000; i < n; i++) {
      const c = computed(() => {
        return v.value * 2
      })
      computeds.push(c)
    }
    let i = 0
    bench('write ref, read 1000 computeds (no effect)', () => {
      v.value = i++
      computeds.forEach(c => c.value)
    })
  }

  {
    const v = ref(100)
    const computeds: ComputedRef<number>[] = []
    for (let i = 0, n = 1000; i < n; i++) {
      const c = computed(() => {
        return v.value * 2
      })
      effect(() => c.value)
      computeds.push(c)
    }
    let i = 0
    bench('write ref, read 1000 computeds (with multiple effects)', () => {
      v.value = i++
      computeds.forEach(c => c.value)
    })
  }

  {
    const v = ref(100)
    const computeds: ComputedRef<number>[] = []
    for (let i = 0, n = 1000; i < n; i++) {
      const c = computed(() => {
        return v.value * 2
      })
      effect(() => c.value)
      computeds.push(c)
    }
    effect(() => {
      for (let i = 0; i < 1000; i++) {
        computeds[i].value
      }
    })
    let i = 0
    bench('write ref, read 1000 computeds (with single effect)', () => {
      v.value = i++
      computeds.forEach(c => c.value)
    })
  }

  {
    const refs: Ref<number>[] = []
    for (let i = 0, n = 1000; i < n; i++) {
      refs.push(ref(i))
    }
    const c = computed(() => {
      let total = 0
      refs.forEach(ref => (total += ref.value))
      return total
    })
    let i = 0
    const n = refs.length
    bench('1000 refs, read 1 computed (without effect)', () => {
      refs[i++ % n].value++
      c.value
    })
  }

  {
    const refs: Ref<number>[] = []
    for (let i = 0, n = 1000; i < n; i++) {
      refs.push(ref(i))
    }
    const c = computed(() => {
      let total = 0
      refs.forEach(ref => (total += ref.value))
      return total
    })
    effect(() => c.value)
    let i = 0
    const n = refs.length
    bench('1000 refs, read 1 computed (with effect)', () => {
      refs[i++ % n].value++
      c.value
    })
  }
})
