import { makeRender, renderParity } from '../_utils'
import { template } from '../../src/dom/template'
import { child } from '../../src/dom/node'
import { setAttr, setClass } from '../../src/dom/prop'
import { renderEffect } from '../../src'
import { nextTick, ref } from '@vue/runtime-dom'

const define = makeRender()
const xlinkNS = 'http://www.w3.org/1999/xlink'

describe('SVG support', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('should mount elements with correct html namespace', () => {
    define({
      setup() {
        const t0 = template(
          `<div id="e0">
            <svg id="e1">
              <foreignObject id="e2">
                <div id="e3"></div>
                <svg id="e4"></svg>
                <math id="e5"></math>
              </foreignObject>
            </svg>
          </div>`,
          1,
        )
        return t0()
      },
    }).render()

    const e0 = document.getElementById('e0')!
    expect(e0.namespaceURI).toMatch('xhtml')
    expect(e0.querySelector('#e1')!.namespaceURI).toMatch('svg')
    expect(e0.querySelector('#e2')!.namespaceURI).toMatch('svg')
    expect(e0.querySelector('#e3')!.namespaceURI).toMatch('xhtml')
    expect(e0.querySelector('#e4')!.namespaceURI).toMatch('svg')
    expect(e0.querySelector('#e5')!.namespaceURI).toMatch('Math')
  })

  test('should patch elements with correct namespaces', async () => {
    const cls = ref('foo')
    define({
      setup() {
        const t0 = template(
          '<div><svg id="f1"><foreignObject><div id="f2">hi</div></foreignObject></svg></div>',
          1,
        )
        const n2 = t0() as HTMLElement
        const n1 = child(n2) as HTMLElement
        const p0 = child(n1) as HTMLElement
        const n0 = child(p0) as HTMLElement
        renderEffect(() => {
          const _cls = cls.value
          setAttr(n1, 'class', _cls)
          setClass(n0, _cls)
        })
        return n2
      },
    }).render()
    const f1 = document.querySelector('#f1')!
    const f2 = document.querySelector('#f2')!
    expect(f1.getAttribute('class')).toBe('foo')
    expect(f2.className).toBe('foo')

    cls.value = 'bar'
    await nextTick()
    expect(f1.getAttribute('class')).toBe('bar')
    expect(f2.className).toBe('bar')
  })

  test('should patch svg elements that share a tag name with html', async () => {
    const attrs: Record<string, any[]> = {}
    const { vdom, vapor } = await renderParity(
      {
        App: `<template><svg>
          <a :href="data.url" :xlink:href="data.url" :class="data.cls"><text>t</text></a>
          <a v-bind="data.attrs"><text>t</text></a>
        </svg></template>`,
      },
      () => ref({ url: '/x', cls: 'link', attrs: { class: 'c', href: '/y' } }),
      async (data, root, mode) => {
        const [a1, a2] = root.querySelectorAll('a')
        const collect = () =>
          (attrs[mode] = [
            a1.getAttribute('href'),
            a1.getAttributeNS(xlinkNS, 'href'),
            a1.getAttribute('class'),
            a2.getAttribute('href'),
            a2.getAttribute('class'),
          ])
        data.value = { url: '/z', cls: 'on', attrs: { class: 'd', href: '/w' } }
        await nextTick()
        collect()
      },
    )
    expect(vapor.after).toBe(vdom.after)
    expect(attrs.vdom).toEqual(['/z', '/z', 'on', '/w', 'd'])
    expect(attrs.vapor).toEqual(attrs.vdom)
  })
})
