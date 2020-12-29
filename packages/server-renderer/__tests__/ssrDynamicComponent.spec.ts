import { createApp, createVNode } from 'vue'
import { renderToString } from '../src/renderToString'

describe('ssr: dynamic component', () => {
  test('resolved to component', async () => {
    expect(
      await renderToString(
        createApp({
          components: {
            one: {
              template: `<div><slot/></div>`
            }
          },
          template: `<component :is="'one'"><span>slot</span></component>`
        })
      )
    ).toBe(`<div><!--[--><span>slot</span><!--]--></div>`)
  })

  test('resolve to element', async () => {
    expect(
      await renderToString(
        createApp({
          template: `<component :is="'p'"><span>slot</span></component>`
        })
      )
    ).toBe(`<p><span>slot</span></p>`)
  })

  test('resolve to component vnode', async () => {
    const Child = {
      props: ['id'],
      template: `<div>{{ id }}<slot/></div>`
    }
    expect(
      await renderToString(
        createApp({
          setup() {
            return {
              vnode: createVNode(Child, { id: 'test' })
            }
          },
          template: `<component :is="vnode"><span>slot</span></component>`
        })
      )
    ).toBe(`<div>test<!--[--><span>slot</span><!--]--></div>`)
  })

  test('resolve to element vnode', async () => {
    expect(
      await renderToString(
        createApp({
          setup() {
            return {
              vnode: createVNode('div', { id: 'test' })
            }
          },
          template: `<component :is="vnode"><span>slot</span></component>`
        })
      )
    ).toBe(`<div id="test"><span>slot</span></div>`)
  })
})
