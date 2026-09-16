import * as Vue from '../src'
import * as SSR from '@vue/server-renderer'
import { compile } from '@vue/compiler-dom'
import { compile as compileSSR } from '@vue/compiler-ssr'
import {
  type ComponentOptions,
  createApp,
  createSSRApp,
  nextTick,
  ref,
} from '../src'

function component(template: string, setup: ComponentOptions['setup']) {
  const { code } = compile(template, {
    mode: 'function',
    prefixIdentifiers: true,
    cacheHandlers: true,
    hoistStatic: true,
  })
  const ssr = compileSSR(template, { mode: 'function' }).code
  return {
    setup,
    render: new Function('Vue', code)(Vue),
    ssrRender: new Function('require', ssr)((name: string) =>
      name === 'vue' ? Vue : SSR,
    ),
  }
}

describe('v-match rendering', () => {
  test.each(['', 'Transition', 'KeepAlive'])(
    'single-root match preserves fallthrough through %s',
    async wrapper => {
      const state = ref<unknown>({ text: 'a' })
      let template = `<template v-match="state"><p v-when="{ const text }">{{ text }}</p><i v-when="_">empty</i></template>`
      if (wrapper) template = `<${wrapper}>${template}</${wrapper}>`
      const App = component(template, () => ({ state }))
      const server = await SSR.renderToString(
        createSSRApp(App, { id: 'fallthrough' }),
      )
      expect(server).toContain('<p id="fallthrough">a</p>')
      const root = document.createElement('div')
      root.innerHTML = server
      const first = root.querySelector('p')
      const app = createSSRApp(App, { id: 'fallthrough' })
      app.mount(root)
      expect(root.querySelector('p')).toBe(first)
      expect(first!.id).toBe('fallthrough')
      app.unmount()
    },
  )

  test('explicit arm keys react within the binding scope', async () => {
    const state = ref({ id: 'a' })
    const App = component(
      `<template v-match="state"><template v-when="{ const id }" :key="id"><input :value="id"/></template></template>`,
      () => ({ state }),
    )
    const root = document.createElement('div')
    const app = createApp(App)
    app.mount(root)
    const first = root.querySelector('input')
    state.value.id = 'b'
    await nextTick()
    expect(root.querySelector('input')).not.toBe(first)
    app.unmount()
  })

  test('client / SSR parity and hydration across reactive arm changes', async () => {
    const result = ref<unknown>({ kind: 'ok', data: 1 })
    const read = vi.fn(() => result.value)
    const received: unknown[] = []
    const App = component(
      `<section v-match="read()"><button v-when="{ kind: 'ok', const data } if (data > 0)" @click="received.push(data)">{{ data }}</button><p v-when="{ kind: 'error', ...const rest }">{{ rest.message }}</p><template v-when="_"></template></section>`,
      () => ({ result, read, received }),
    )
    const root = document.createElement('div')
    root.innerHTML = await SSR.renderToString(createSSRApp(App))
    expect(read).toHaveBeenCalledTimes(1)
    const button = root.querySelector('button')!
    const app = createSSRApp(App)
    app.mount(root)
    expect(root.querySelector('button')).toBe(button)
    expect(read).toHaveBeenCalledTimes(2)
    button.click()
    expect(received).toEqual([1])
    result.value = { kind: 'ok', data: 2 }
    await nextTick()
    expect(root.querySelector('button')).toBe(button)
    button.click()
    expect(received).toEqual([1, 2])
    expect(read).toHaveBeenCalledTimes(3)
    result.value = { kind: 'error', message: '<failure>' }
    await nextTick()
    expect(root.textContent).toBe('<failure>')
    expect(root.querySelector('button')).toBeNull()
    const server = document.createElement('div')
    server.innerHTML = await SSR.renderToString(createSSRApp(App))
    expect(server.textContent).toBe(root.textContent)
    expect(server.querySelector('p')!.outerHTML).toBe(
      root.querySelector('p')!.outerHTML,
    )
    const serverP = server.querySelector('p')
    const hydrated = createSSRApp(App)
    hydrated.mount(server)
    expect(server.querySelector('p')).toBe(serverP)
    hydrated.unmount()
    result.value = null
    await nextTick()
    expect(root.textContent).toBe('')
    app.unmount()
  })

  test('identical tags in different arms get distinct identity', async () => {
    const state = ref('a')
    const App = component(
      `<template v-match="state"><input v-when="'a'" value="a"/><input v-when="'b'" value="b"/></template>`,
      () => ({ state }),
    )
    const root = document.createElement('div')
    const app = createApp(App)
    app.mount(root)
    const first = root.querySelector('input')!
    first.value = 'edited'
    state.value = 'b'
    await nextTick()
    expect(root.querySelector('input')).not.toBe(first)
    expect(root.querySelector('input')!.value).toBe('b')
    state.value = 'unmatched'
    await nextTick()
    expect(root.querySelector('input')).toBeNull()
    app.unmount()
  })

  test('nested scopes do not leak and array rest stays reactive', async () => {
    const items = ref([[1, 2], [3]])
    const App = component(
      `<div v-for="item in items"><template v-match="item"><template v-when="[const head, ...const tail]"><template v-match="head"><b v-when="1">one:{{ tail.join(',') }}</b><b v-when="const value">{{ value }}:{{ tail.length }}</b></template></template><i v-when="[]">empty</i></template></div>`,
      () => ({ items }),
    )
    const root = document.createElement('div')
    const app = createApp(App)
    app.mount(root)
    expect(root.textContent).toBe('one:23:0')
    items.value[0].push(4)
    items.value[1] = []
    await nextTick()
    expect(root.textContent).toBe('one:2,4empty')
    app.unmount()
  })

  test('SSR and hydration preserve shadowed loop bindings and props', async () => {
    const rows = ref([{ value: 'arm' }])
    const App = {
      ...component(
        `<main><div v-for="value in rows"><template v-match="value"><section v-when="{ const value }" :title="value"><b v-for="value in [1, 2]">{{ value }}</b><i>{{ value }}</i></section></template><p>{{ value.value }}</p></div><footer>{{ value }}</footer></main>`,
        () => ({ rows }),
      ),
      props: ['value'],
    }
    const root = document.createElement('div')
    root.innerHTML = await SSR.renderToString(
      createSSRApp(App, { value: 'prop' }),
    )
    expect(root.textContent).toBe('12armarmprop')
    const section = root.querySelector('section')!
    expect(section.title).toBe('arm')
    const app = createSSRApp(App, { value: 'prop' })
    app.mount(root)
    expect(root.querySelector('section')).toBe(section)
    rows.value[0].value = 'updated'
    await nextTick()
    expect(root.textContent).toBe('12updatedupdatedprop')
    expect(section.title).toBe('updated')
    app.unmount()
  })
})
