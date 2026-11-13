import { Teleport, createApp, defineAsyncComponent, h } from 'vue'
import { renderToString } from '../src/renderToString'
import { renderToSimpleStream } from '../src/renderToStream'
import type { SSRContext } from '../src/render'
import { ssrRenderTeleport } from '../src/helpers/ssrRenderTeleport'
import * as runtimeDom from '@vue/runtime-dom'
import * as serverRenderer from '@vue/server-renderer'
import { compile as compileSSR } from '@vue/compiler-ssr'

describe('ssrRenderTeleport', () => {
  test('teleport rendering (compiled)', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      createApp({
        data() {
          return { msg: 'hello' }
        },
        ssrRender(_ctx, _push, _parent) {
          ssrRenderTeleport(
            _push,
            _push => {
              _push(`<div>content</div>`)
            },
            '#target',
            false,
            _parent,
          )
        },
      }),
      ctx,
    )
    expect(html).toBe('<!--teleport start--><!--teleport end-->')
    expect(ctx.teleports!['#target']).toBe(
      `<!--teleport start anchor--><div>content</div><!--teleport anchor-->`,
    )
  })

  test('teleport rendering (compiled + disabled)', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      createApp({
        data() {
          return { msg: 'hello' }
        },
        ssrRender(_ctx, _push, _parent) {
          ssrRenderTeleport(
            _push,
            _push => {
              _push(`<div>content</div>`)
            },
            '#target',
            true,
            _parent,
          )
        },
      }),
      ctx,
    )
    expect(html).toBe(
      '<!--teleport start--><div>content</div><!--teleport end-->',
    )
    expect(ctx.teleports!['#target']).toBe(
      `<!--teleport start anchor--><!--teleport anchor-->`,
    )
  })

  test('teleport rendering (vnode)', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      h(
        Teleport,
        {
          to: `#target`,
        },
        h('span', 'hello'),
      ),
      ctx,
    )
    expect(html).toBe('<!--teleport start--><!--teleport end-->')
    expect(ctx.teleports!['#target']).toBe(
      '<!--teleport start anchor--><span>hello</span><!--teleport anchor-->',
    )
  })

  test('teleport rendering (vnode + disabled)', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      h(
        Teleport,
        {
          to: `#target`,
          disabled: true,
        },
        h('span', 'hello'),
      ),
      ctx,
    )
    expect(html).toBe(
      '<!--teleport start--><span>hello</span><!--teleport end-->',
    )
    expect(ctx.teleports!['#target']).toBe(
      `<!--teleport start anchor--><!--teleport anchor-->`,
    )
  })

  test('multiple teleports with same target', async () => {
    const ctx: SSRContext = {}
    const html = await renderToString(
      h('div', [
        h(
          Teleport,
          {
            to: `#target`,
          },
          h('span', 'hello'),
        ),
        h(Teleport, { to: `#target` }, 'world'),
      ]),
      ctx,
    )
    expect(html).toBe(
      '<div><!--teleport start--><!--teleport end--><!--teleport start--><!--teleport end--></div>',
    )
    expect(ctx.teleports!['#target']).toBe(
      '<!--teleport start anchor--><span>hello</span><!--teleport anchor-->' +
        '<!--teleport start anchor-->world<!--teleport anchor-->',
    )
  })

  test('teleport inside async component', async () => {
    const ctx: SSRContext = {}
    const asyncComponent = {
      template: '<teleport to="#target"><div>content</div></teleport>',
      async setup() {},
    }
    const html = await renderToString(
      h({
        template: '<async-component />',
        components: { asyncComponent },
      }),
      ctx,
    )
    expect(html).toBe('<!--teleport start--><!--teleport end-->')
    expect(ctx.teleports!['#target']).toBe(
      `<!--teleport start anchor--><div>content</div><!--teleport anchor-->`,
    )
  })

  test('teleport inside async component (stream)', async () => {
    const ctx: SSRContext = {}
    const asyncComponent = {
      template: '<teleport to="#target"><div>content</div></teleport>',
      async setup() {},
    }
    let html = ''
    let resolve: any
    const p = new Promise(r => (resolve = r))
    renderToSimpleStream(
      h({
        template: '<async-component />',
        components: { asyncComponent },
      }),
      ctx,
      {
        push(chunk) {
          if (chunk === null) {
            resolve()
          } else {
            html += chunk
          }
        },
        destroy(err) {
          throw err
        },
      },
    )
    await p
    expect(html).toBe('<!--teleport start--><!--teleport end-->')
    expect(ctx.teleports!['#target']).toBe(
      `<!--teleport start anchor--><div>content</div><!--teleport anchor-->`,
    )
  })

  test('teleport resolves nested async content inside suspense', async () => {
    const ctx: SSRContext = {}

    const AsyncChild = defineAsyncComponent(() =>
      Promise.resolve({
        render: () => h('span', 'async'),
      }),
    )
    const Wrapper = {
      render: () => h('div', h(AsyncChild)),
    }
    const Comp = {
      template:
        '<teleport to="#target"><Suspense><Wrapper /></Suspense></teleport>',
      components: { Wrapper },
    }

    const html = await renderToString(
      h({
        template: '<Comp />',
        components: { Comp },
      }),
      ctx,
    )
    expect(html).toBe('<!--teleport start--><!--teleport end-->')
    expect(ctx.teleports!['#target']).toBe(
      `<!--teleport start anchor--><div><span>async</span></div><!--teleport anchor-->`,
    )
  })
  test('css vars of the owner reach the teleported content (compiled)', async () => {
    const { code } = compileSSR(
      `<Teleport to="#target"><div>content</div></Teleport>`,
      { ssrCssVars: `{ "--color": color }` },
    )
    const ctx: SSRContext = {}
    const html = await renderToString(
      createApp({
        data: () => ({ color: 'red' }),
        ssrRender: new Function('require', code)((id: string) =>
          id === 'vue' ? runtimeDom : serverRenderer,
        ),
      }),
      ctx,
    )
    expect(html).toBe('<!--teleport start--><!--teleport end-->')
    expect(ctx.teleports!['#target']).toBe(
      `<!--teleport start anchor--><div style="--color:red;">content</div><!--teleport anchor-->`,
    )
  })
})
