import { bench, describe } from 'vitest'
import { type ComputedRef, type Ref, computed, ref } from '../src/index'

describe('computed', () => {
  bench('create computed', () => {
    computed(() => 100)
  })

  {
    let i = 0
    const o = ref(100)
    bench('write independent ref dep', () => {
      o.value = i++
    })
  }

  {
    const v = ref(100)
    computed(() => v.value * 2)
    let i = 0
    bench("write ref, don't read computed (never invoked)", () => {
      v.value = i++
    })
  }

  {
    const v = ref(100)
    computed(() => {
      return v.value * 2
    })
    let i = 0
    bench("write ref, don't read computed (never invoked)", () => {
      v.value = i++
    })
  }

  {
    const v = ref(100)
    const c = computed(() => {
      return v.value * 2
    })
    c.value
    let i = 0
    bench("write ref, don't read computed (invoked)", () => {
      v.value = i++
    })
  }

  {
    const v = ref(100)
    const c = computed(() => {
      return v.value * 2
    })
    let i = 0
    bench('write ref, read computed', () => {
      v.value = i++
      c.value
    })
  }

  {
    const v = ref(100)
    const computeds = []
    for (let i = 0, n = 1000; i < n; i++) {
      const c = computed(() => {
        return v.value * 2
      })
      computeds.push(c)
    }
    let i = 0
    bench("write ref, don't read 1000 computeds (never invoked)", () => {
      v.value = i++
    })
  }

  {
    const v = ref(100)
    const computeds = []
    for (let i = 0, n = 1000; i < n; i++) {
      const c = computed(() => {
        return v.value * 2
      })
      c.value
      computeds.push(c)
    }
    let i = 0
    bench("write ref, don't read 1000 computeds (invoked)", () => {
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
      c.value
      computeds.push(c)
    }
    let i = 0
    bench('write ref, read 1000 computeds', () => {
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
    bench('1000 refs, 1 computed', () => {
      refs[i++ % n].value++
      c.value
    })
  }
})
