import { nextTick, ref } from '@vue/runtime-dom'
import { setupHydrationTest, testHydration } from './_helpers'

setupHydrationTest()

// The `<!>` placeholder contract: every anchored dynamic block occupies one
// SSR logical unit at its template element index, so hydration drives the
// same locators as client render. Each scenario proves alignment by updating
// bindings located across dynamic-block SSR output after hydration — a
// mislocated node would leave stale text or patch the wrong element.
describe('placeholder unit alignment', () => {
  test('statics after a prepended block hydrate at the right units', async () => {
    const data = ref({ a: 'a', b: 'b' })
    const { container } = await testHydration(
      `<template><div><components.Child/><p>{{ data.a }}</p><span>{{ data.b }}</span></div></template>`,
      { Child: `<template><b>child</b></template>` },
      data,
    )
    expect(container.innerHTML).toBe(
      `<div><b>child</b><p>a</p><span>b</span></div>`,
    )

    data.value = { a: 'a2', b: 'b2' }
    await nextTick()
    expect(container.innerHTML).toBe(
      `<div><b>child</b><p>a2</p><span>b2</span></div>`,
    )
  })

  test('middle block between referenced statics', async () => {
    const data = ref({ a: 'a', b: 'b', show: true })
    const { container } = await testHydration(
      `<template><div><h1>{{ data.a }}</h1><span v-if="data.show">yes</span><p>{{ data.b }}</p></div></template>`,
      {},
      data,
    )
    expect(container.innerHTML).toBe(
      `<div><h1>a</h1><span>yes</span><!--if--><p>b</p></div>`,
    )

    data.value = { a: 'a2', b: 'b2', show: false }
    await nextTick()
    expect(container.innerHTML).toBe(`<div><h1>a2</h1><!--if--><p>b2</p></div>`)
  })

  test('middle multi-root component keeps following statics aligned', async () => {
    const data = ref({ tail: 't' })
    const { container } = await testHydration(
      `<template><div><h1>h</h1><components.Multi/><p>{{ data.tail }}</p></div></template>`,
      { Multi: `<template><i>x</i><b>y</b></template>` },
      data,
    )
    expect(container.innerHTML).toBe(
      `<div><h1>h</h1><!--[--><i>x</i><b>y</b><!--]--><p>t</p></div>`,
    )

    data.value = { tail: 't2' }
    await nextTick()
    expect(container.innerHTML).toBe(
      `<div><h1>h</h1><!--[--><i>x</i><b>y</b><!--]--><p>t2</p></div>`,
    )
  })

  test('append run occupies successive units', async () => {
    const data = ref({ a: 'a', b: 'b', c: 'c' })
    const { container } = await testHydration(
      `<template><div><p>{{ data.a }}</p><components.B/><components.C/></div></template>`,
      {
        B: `<template><b>{{ data.b }}</b></template>`,
        C: `<template><i>{{ data.c }}</i></template>`,
      },
      data,
    )
    expect(container.innerHTML).toBe(`<div><p>a</p><b>b</b><i>c</i></div>`)

    data.value = { a: 'a2', b: 'b2', c: 'c2' }
    await nextTick()
    expect(container.innerHTML).toBe(`<div><p>a2</p><b>b2</b><i>c2</i></div>`)
  })

  test('middle v-for fast-forward keeps the trailing static reactive', async () => {
    const data = ref({ list: ['x', 'y'], tail: 't' })
    const { container } = await testHydration(
      `<template><div><h1>h</h1><li v-for="i in data.list">{{ i }}</li><p>{{ data.tail }}</p></div></template>`,
      {},
      data,
    )
    expect(container.innerHTML).toBe(
      `<div><h1>h</h1><!--[--><li>x</li><li>y</li><!--]--><p>t</p></div>`,
    )

    data.value = { list: ['x', 'y', 'z'], tail: 't2' }
    await nextTick()
    expect(container.innerHTML).toBe(
      `<div><h1>h</h1><!--[--><li>x</li><li>y</li><li>z</li><!--]--><p>t2</p></div>`,
    )
  })
})
