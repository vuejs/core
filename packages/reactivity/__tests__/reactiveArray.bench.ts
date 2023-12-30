import { bench } from 'vitest'
import { computed, reactive, readonly, shallowRef, triggerRef } from '../src'

for (let amount = 1e1; amount < 1e4; amount *= 10) {
  {
    const rawArray = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const r = reactive(rawArray)
    const c = computed(() => {
      return r.reduce((v, a) => a + v, 0)
    })

    bench(`reduce *reactive* array, ${amount} elements`, () => {
      for (let i = 0, n = r.length; i < n; i++) {
        r[i]++
      }
      c.value
    })
  }

  {
    const rawArray = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const r = reactive(rawArray)
    const c = computed(() => {
      return r.reduce((v, a) => a + v, 0)
    })

    bench(
      `reduce *reactive* array, ${amount} elements, only change first value`,
      () => {
        r[0]++
        c.value
      },
    )
  }

  {
    const rawArray = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const r = reactive({ arr: readonly(rawArray) })
    const c = computed(() => {
      return r.arr.reduce((v, a) => a + v, 0)
    })

    bench(`reduce *readonly* array, ${amount} elements`, () => {
      r.arr = r.arr.map(v => v + 1)
      c.value
    })
  }

  {
    const rawArray = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const r = shallowRef(rawArray)
    const c = computed(() => {
      return r.value.reduce((v, a) => a + v, 0)
    })

    bench(`reduce *raw* array, copied, ${amount} elements`, () => {
      r.value = r.value.map(v => v + 1)
      c.value
    })
  }

  {
    const rawArray: number[] = []
    for (let i = 0, n = amount; i < n; i++) {
      rawArray.push(i)
    }
    const r = shallowRef(rawArray)
    const c = computed(() => {
      return r.value.reduce((v, a) => a + v, 0)
    })

    bench(`reduce *raw* array, manually triggered, ${amount} elements`, () => {
      for (let i = 0, n = rawArray.length; i < n; i++) {
        rawArray[i]++
      }
      triggerRef(r)
      c.value
    })
  }
}
