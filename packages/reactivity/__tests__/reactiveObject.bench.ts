import { bench } from 'vitest'
import { type ComputedRef, computed, reactive } from '../src'

bench('create reactive obj', () => {
  reactive({ a: 1 })
})

{
  let i = 0
  const r = reactive({ a: 1 })
  bench('write reactive obj property', () => {
    r.a = i++
  })
}

{
  const r = reactive({ a: 1 })
  computed(() => {
    return r.a * 2
  })
  let i = 0
  bench("write reactive obj, don't read computed (never invoked)", () => {
    r.a = i++
  })
}

{
  const r = reactive({ a: 1 })
  const c = computed(() => {
    return r.a * 2
  })
  c.value
  let i = 0
  bench("write reactive obj, don't read computed (invoked)", () => {
    r.a = i++
  })
}

{
  const r = reactive({ a: 1 })
  const c = computed(() => {
    return r.a * 2
  })
  let i = 0
  bench('write reactive obj, read computed', () => {
    r.a = i++
    c.value
  })
}

{
  const r = reactive({ a: 1 })
  const computeds = []
  for (let i = 0, n = 1000; i < n; i++) {
    const c = computed(() => {
      return r.a * 2
    })
    computeds.push(c)
  }
  let i = 0
  bench("write reactive obj, don't read 1000 computeds (never invoked)", () => {
    r.a = i++
  })
}

{
  const r = reactive({ a: 1 })
  const computeds = []
  for (let i = 0, n = 1000; i < n; i++) {
    const c = computed(() => {
      return r.a * 2
    })
    c.value
    computeds.push(c)
  }
  let i = 0
  bench("write reactive obj, don't read 1000 computeds (invoked)", () => {
    r.a = i++
  })
}

{
  const r = reactive({ a: 1 })
  const computeds: ComputedRef<number>[] = []
  for (let i = 0, n = 1000; i < n; i++) {
    const c = computed(() => {
      return r.a * 2
    })
    computeds.push(c)
  }
  let i = 0
  bench('write reactive obj, read 1000 computeds', () => {
    r.a = i++
    computeds.forEach(c => c.value)
  })
}

{
  const reactives: Record<string, number>[] = []
  for (let i = 0, n = 1000; i < n; i++) {
    reactives.push(reactive({ a: i }))
  }
  const c = computed(() => {
    let total = 0
    reactives.forEach(r => (total += r.a))
    return total
  })
  let i = 0
  const n = reactives.length
  bench('1000 reactive objs, 1 computed', () => {
    reactives[i++ % n].a++
    c.value
  })
}
