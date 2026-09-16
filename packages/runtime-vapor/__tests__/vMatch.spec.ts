import { nextTick, ref } from '@vue/runtime-dom'
import { renderParity } from './_utils'

describe('v-match VDOM / Vapor parity', () => {
  test('template arm keys remount while empty arms stop fallthrough', async () => {
    await renderParity(
      {
        App: `<template><template v-match="data"><template v-when="{ const id }" :key="id"><input :value="id"/></template><template v-when="null"></template><b v-when="_">fallback</b></template></template>`,
      },
      () => ref<unknown>({ id: 'a' }),
      async (data, root) => {
        const first = root.querySelector('input')
        data.value = { id: 'b' }
        await nextTick()
        expect(root.querySelector('input')).not.toBe(first)
        data.value = null
        await nextTick()
        expect(root.textContent).toBe('')
        data.value = 42
        await nextTick()
        expect(root.textContent).toBe('fallback')
      },
    )
  })

  test('reactive selection, guards, rest and event binding lifetime', async () => {
    const results = await renderParity(
      {
        App: `<template><section v-match="data.value"><button v-when="{ kind: 'ok', const value, ...const rest } if (value > 0)" @click="data.clicked.push(value)">{{ value }}:{{ rest.label }}</button><p v-when="_">empty</p></section></template>`,
      },
      () =>
        ref({
          value: { kind: 'ok', value: 1, label: 'first' },
          clicked: [] as number[],
        }),
      async (data, root) => {
        expect(root.textContent).toBe('1:first')
        const button = root.querySelector('button')!
        button.click()
        data.value.value = { kind: 'ok', value: 2, label: 'second' }
        await nextTick()
        expect(root.querySelector('button')).toBe(button)
        button.click()
        expect(data.value.clicked).toEqual([1, 2])
        expect(root.textContent).toBe('2:second')
        data.value.value.value = 0
        await nextTick()
        expect(root.querySelector('button')).toBeNull()
      },
    )
    expect(results.vdom.text).toBe('empty')
    expect(results.vapor.text).toBe(results.vdom.text)
  })

  test('nested match and array rest react to in-place updates', async () => {
    const results = await renderParity(
      {
        App: `<template><template v-match="data"><template v-when="[const first, ...const tail]"><template v-match="first"><b v-when="1">one:{{ tail.join(',') }}</b><b v-when="const other">{{ other }}</b></template></template><p v-when="[]">empty</p></template></template>`,
      },
      () => ref([1, 2]),
      async (data, root) => {
        expect(root.textContent).toBe('one:2')
        data.value.push(3)
        await nextTick()
        expect(root.textContent).toBe('one:2,3')
        data.value = []
      },
    )
    expect(results.vdom.text).toBe('empty')
    expect(results.vapor.text).toBe('empty')
  })
})
