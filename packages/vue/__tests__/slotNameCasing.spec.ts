import { createApp } from '../src'

// https://github.com/vuejs/core/issues/14300
describe('slot name casing in in-DOM templates', () => {
  const Child = {
    template: `<div><slot name="dropdownRender">fallback</slot></div>`,
  }

  function mountInDom(html: string) {
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    createApp({ components: { Child } }).mount(container)
    return container.innerHTML
  }

  test('kebab-cased v-slot resolves a camelCase slot', () => {
    expect(
      mountInDom(
        `<Child><template v-slot:dropdown-render>content</template></Child>`,
      ),
    ).toBe(`<div>content</div>`)
  })

  test('kebab-cased shorthand resolves a camelCase slot', () => {
    expect(
      mountInDom(
        `<Child><template #dropdown-render>content</template></Child>`,
      ),
    ).toBe(`<div>content</div>`)
  })

  test('an exact match wins over a competing hyphenated one', () => {
    const container = document.createElement('div')
    createApp({
      components: { Child },
      template:
        `<Child>` +
        `<template #dropdownRender>exact</template>` +
        `<template #dropdown-render>hyphenated</template>` +
        `</Child>`,
    }).mount(container)

    expect(container.innerHTML).toBe(`<div>exact</div>`)
  })

  test('a genuinely kebab-cased slot name is unaffected', () => {
    const KebabChild = {
      template: `<div><slot name="dropdown-render">fallback</slot></div>`,
    }
    const container = document.createElement('div')
    createApp({
      components: { KebabChild },
      template: `<KebabChild><template #dropdown-render>content</template></KebabChild>`,
    }).mount(container)

    expect(container.innerHTML).toBe(`<div>content</div>`)
  })

  test('falls back when no slot matches', () => {
    expect(
      mountInDom(`<Child><template #somethingElse>content</template></Child>`),
    ).toBe(`<div>fallback</div>`)
  })
})
