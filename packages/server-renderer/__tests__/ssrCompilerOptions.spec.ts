/**
 * @jest-environment node
 */

import { createApp } from 'vue'
import { renderToString } from '../src/renderToString'

describe('ssr: compiler options', () => {
  test('config.isCustomElement (deprecated)', async () => {
    const app = createApp({
      template: `<div><x-button/></div>`
    })
    app.config.isCustomElement = tag => tag.startsWith('x-')
    expect(await renderToString(app)).toBe(`<div><x-button></x-button></div>`)
  })

  test('config.compilerOptions.isCustomElement', async () => {
    const app = createApp({
      template: `<div><x-panel/></div>`
    })
    app.config.compilerOptions.isCustomElement = tag => tag.startsWith('x-')
    expect(await renderToString(app)).toBe(`<div><x-panel></x-panel></div>`)
  })

  test('component.compilerOptions.isCustomElement', async () => {
    const app = createApp({
      template: `<div><x-card/><y-child/></div>`,
      compilerOptions: {
        isCustomElement: (tag: string) => tag.startsWith('x-')
      },
      components: {
        YChild: {
          template: `<div><y-button/></div>`
        }
      }
    })
    app.config.compilerOptions.isCustomElement = tag => tag.startsWith('y-')
    expect(await renderToString(app)).toBe(
      `<div><x-card></x-card><div><y-button></y-button></div></div>`
    )
  })

  test('component.delimiters (deprecated)', async () => {
    const app = createApp({
      template: `<div>[[ 1 + 1 ]]</div>`,
      delimiters: ['[[', ']]']
    })
    expect(await renderToString(app)).toBe(`<div>2</div>`)
  })

  test('config.compilerOptions.delimiters', async () => {
    const app = createApp({
      template: `<div>[[ 1 + 1 ]]</div>`
    })
    app.config.compilerOptions.delimiters = ['[[', ']]']
    expect(await renderToString(app)).toBe(`<div>2</div>`)
  })

  test('component.compilerOptions.delimiters', async () => {
    const app = createApp({
      template: `<div>[[ 1 + 1 ]]<ChildComponent/></div>`,
      compilerOptions: {
        delimiters: ['[[', ']]']
      },
      components: {
        ChildComponent: {
          template: `<div>(( 2 + 2 ))</div>`
        }
      }
    })
    app.config.compilerOptions.delimiters = ['((', '))']
    expect(await renderToString(app)).toBe(`<div>2<div>4</div></div>`)
  })

  test('compilerOptions.whitespace', async () => {
    const app = createApp({
      template: `<div><span>Hello   world</span><ChildComponent/></div>`,
      compilerOptions: {
        whitespace: 'condense'
      },
      components: {
        ChildComponent: {
          template: `<span>Hello   world</span>`
        }
      }
    })
    app.config.compilerOptions.whitespace = 'preserve'
    expect(await renderToString(app)).toBe(
      `<div><span>Hello world</span><span>Hello   world</span></div>`
    )
  })
})
