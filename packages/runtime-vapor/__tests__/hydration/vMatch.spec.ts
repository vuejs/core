import { nextTick, ref } from '@vue/runtime-dom'
import { setupHydrationTest, testHydration } from './_helpers'

setupHydrationTest()

describe('patterned templates hydration', () => {
  test('hydrates nested multi-root binding arms and retains sibling nodes', async () => {
    const data = ref({ items: [1, 2, 3] })
    const { container, app } = await testHydration(
      `<template><section><template v-match="data"><template v-when="{ items: [const first, ...const tail] }"><b>{{ first }}</b><i>{{ tail.join(',') }}</i></template><template v-when="_"></template></template><span>after</span></section></template>`,
      {},
      data,
    )
    const span = container.querySelector('span')
    expect(container.textContent).toBe('12,3after')
    data.value.items = []
    await nextTick()
    expect(container.textContent).toBe('after')
    expect(container.querySelector('span')).toBe(span)
    app.unmount()
  })

  test.each([false, true])(
    'hydrates and updates the first matching arm (bound=%s)',
    async bindings => {
      const data = ref<unknown>({ kind: 'ok', text: 'first' })
      const { container, app } = await testHydration(
        `<template><template v-match="data"><p v-when="${bindings ? "{ kind: 'ok', const text }" : "{ kind: 'ok' }"}">${bindings ? '{{ text }}' : 'ok'}</p><i v-when="_">empty</i></template></template>`,
        {},
        data,
      )
      const p = container.querySelector('p')
      expect(p).not.toBeNull()
      data.value = { kind: 'ok', text: 'second' }
      await nextTick()
      expect(container.querySelector('p')).toBe(p)
      expect(container.textContent).toBe(bindings ? 'second' : 'ok')
      data.value = null
      await nextTick()
      expect(container.querySelector('p')).toBeNull()
      expect(container.textContent).toBe('empty')
      app.unmount()
    },
  )
})
