import { bench } from 'vitest'
import { reactive } from '../dist/reactivity.esm-browser.prod'

bench('create reactive obj', () => {
  reactive({ a: 1 })
})

{
  const raw = { a: 1 }
  reactive(raw)
  bench('return cached reactive obj', () => {
    reactive(raw)
  })
}

{
  const r = reactive({ a: 1 })
  bench('read reactive obj property', () => {
    r.a
  })
}

{
  const r = reactive({ a: { b: 1 } })
  bench('read nested reactive obj property', () => {
    r.a.b
  })
}

{
  let i = 0
  const r = reactive({ a: 1 })
  bench('write reactive obj property', () => {
    r.a = i++
  })
}
