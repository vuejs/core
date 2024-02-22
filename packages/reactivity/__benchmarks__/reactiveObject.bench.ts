import { bench } from 'vitest'
import { reactive } from '../src'

bench('create reactive obj', () => {
  reactive({ a: 1 })
})

{
  const r = reactive({ a: 1 })
  bench('read reactive obj property', () => {
    r.a
  })
}

{
  let i = 0
  const r = reactive({ a: 1 })
  bench('write reactive obj property', () => {
    r.a = i++
  })
}
