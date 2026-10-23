import { createApp } from 'vue'
import { renderToString } from '../src/renderToString'

describe('ssr: attr fallthrough', () => {
  test('basic', async () => {
    const Child = {
      template: `<div class="foo" />`,
    }
    const Parent = {
      components: { Child },
      template: `<child class="bar"/>`,
    }
    const app = createApp(Parent)
    expect(await renderToString(app)).toBe(`<div class="foo bar"></div>`)
  })

  test('with v-if', async () => {
    const Child = {
      props: ['ok'],
      template: `<div v-if="ok" class="foo" /><span v-else />`,
    }
    const Parent = {
      props: ['ok'],
      components: { Child },
      template: `<child :ok="ok" class="bar"/>`,
    }
    expect(await renderToString(createApp(Parent, { ok: true }))).toBe(
      `<div class="foo bar"></div>`,
    )
    expect(await renderToString(createApp(Parent, { ok: false }))).toBe(
      `<span class="bar"></span>`,
    )
  })

  test('with v-model', async () => {
    const Child = {
      props: ['text'],
      template: `<input v-model="text">`,
    }
    const Parent = {
      components: { Child },
      template: `<child text="hello" class="bar"/>`,
    }
    expect(await renderToString(createApp(Parent))).toBe(
      `<input class="bar" value="hello">`,
    )
  })

  test('with v-bind', async () => {
    const Child = {
      props: ['obj'],
      template: `<div v-bind="obj" />`,
    }
    const Parent = {
      components: { Child },
      template: `<child :obj="{ class: 'foo' }" class="bar"/>`,
    }
    expect(await renderToString(createApp(Parent))).toBe(
      `<div class="foo bar"></div>`,
    )
  })

  test('nested fallthrough', async () => {
    const Child = {
      props: ['id'],
      template: `<div :id="id"></div>`,
    }
    const Parent = {
      components: { Child },
      template: `<child id="foo" class="bar"/>`,
    }
    // pass to parent, fallthrough to child and merge
    const app = createApp(Parent, { class: 'baz' })
    expect(await renderToString(app)).toBe(
      `<div id="foo" class="bar baz"></div>`,
    )
  })

  test('SVG root preserves attribute casing', async () => {
    const Child = {
      template: `<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>`,
    }
    const Parent = {
      components: { Child },
      template: `<child aria-hidden="true"/>`,
    }
    expect(await renderToString(createApp(Parent))).toBe(
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M0 0"></path></svg>`,
    )
  })

  test('SVG child component preserves attribute casing', async () => {
    const Child = {
      template: `<path :pathLength="10"/>`,
    }
    const Parent = {
      components: { Child },
      template: `<svg><child stroke-width="2"/></svg>`,
    }
    expect(await renderToString(createApp(Parent))).toBe(
      `<svg><path pathLength="10" stroke-width="2"></path></svg>`,
    )
  })

  test('HTML title normalizes boolean attributes', async () => {
    const app = createApp({
      template: `<title v-bind="{ itemScope: false }">Page</title>`,
    })
    expect(await renderToString(app)).toBe(`<title>Page</title>`)
  })
})
