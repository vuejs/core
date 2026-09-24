import { test } from '../../../scripts/bench'
import * as reactivity from '../dist/reactivity.esm-browser.prod'

const { reactive } = reactivity

test('create reactive obj', async ({ benchmark }) => {
  await benchmark(() => {
    reactive({ a: 1 })
  })
})

{
  const raw = { a: 1 }
  reactive(raw)
  test('return cached reactive obj', async ({ benchmark }) => {
    await benchmark(() => {
      reactive(raw)
    })
  })
}

{
  const r = reactive({ a: 1 })
  test('read reactive obj property', async ({ benchmark }) => {
    await benchmark(() => {
      r.a
    })
  })
}

{
  const r = reactive({ a: { b: 1 } })
  test('read nested reactive obj property', async ({ benchmark }) => {
    await benchmark(() => {
      r.a.b
    })
  })
}

{
  let i = 0
  const r = reactive({ a: 1 })
  test('write reactive obj property', async ({ benchmark }) => {
    await benchmark(() => {
      r.a = i++
    })
  })
}
