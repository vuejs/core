/**
 * @jest-environment node
 */

import { createApp } from 'vue'
import { renderToString } from '../src/renderToString'

describe('ssr: attr fallthrough', () => {
  test('basic', async () => {
    const Child = {
      template: `<div class="foo" />`
    }
    const Parent = {
      components: { Child },
      template: `<child class="bar"/>`
    }
    const app = createApp(Parent)
    expect(await renderToString(app)).toBe(`<div class="foo bar"></div>`)
  })

  test('with v-if', async () => {
    const Child = {
      props: ['ok'],
      template: `<div v-if="ok" class="foo" /><span v-else />`
    }
    const Parent = {
      props: ['ok'],
      components: { Child },
      template: `<child :ok="ok" class="bar"/>`
    }
    expect(await renderToString(createApp(Parent, { ok: true }))).toBe(
      `<div class="foo bar"></div>`
    )
    expect(await renderToString(createApp(Parent, { ok: false }))).toBe(
      `<span class="bar"></span>`
    )
  })

  test('with v-model', async () => {
    const Child = {
      props: ['text'],
      template: `<input v-model="text">`
    }
    const Parent = {
      components: { Child },
      template: `<child text="hello" class="bar"/>`
    }
    expect(await renderToString(createApp(Parent))).toBe(
      `<input class="bar" value="hello">`
    )
  })

  test('with v-bind', async () => {
    const Child = {
      props: ['obj'],
      template: `<div v-bind="obj" />`
    }
    const Parent = {
      components: { Child },
      template: `<child :obj="{ class: 'foo' }" class="bar"/>`
    }
    expect(await renderToString(createApp(Parent))).toBe(
      `<div class="foo bar"></div>`
    )
  })

  test('nested fallthrough', async () => {
    const Child = {
      props: ['id'],
      template: `<div :id="id"></div>`
    }
    const Parent = {
      components: { Child },
      template: `<child id="foo" class="bar"/>`
    }
    // pass to parent, fallthrough to child and merge
    const app = createApp(Parent, { class: 'baz' })
    expect(await renderToString(app)).toBe(
      `<div id="foo" class="bar baz"></div>`
    )
  })
})
