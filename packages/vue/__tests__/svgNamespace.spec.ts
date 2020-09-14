// SVG logic is technically dom-specific, but the logic is placed in core
// because splitting it out of core would lead to unnecessary complexity in both
// the renderer and compiler implementations.
// Related files:
// - runtime-core/src/renderer.ts
// - compiler-core/src/transforms/transformElement.ts

import { render, h, ref, nextTick } from '../src'

describe('SVG support', () => {
  test('should mount elements with correct namespaces', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const App = {
      template: `
        <div id="e0">
          <svg id="e1">
            <foreignObject id="e2">
              <div id="e3"/>
            </foreignObject>
          </svg>
        </div>
      `
    }
    render(h(App), root)
    const e0 = document.getElementById('e0')!
    expect(e0.namespaceURI).toMatch('xhtml')
    expect(e0.querySelector('#e1')!.namespaceURI).toMatch('svg')
    expect(e0.querySelector('#e2')!.namespaceURI).toMatch('svg')
    expect(e0.querySelector('#e3')!.namespaceURI).toMatch('xhtml')
  })

  test('should patch elements with correct namespaces', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cls = ref('foo')
    const App = {
      setup: () => ({ cls }),
      template: `
        <div>
          <svg id="f1" :class="cls">
            <foreignObject>
              <div id="f2" :class="cls"/>
            </foreignObject>
          </svg>
        </div>
      `
    }
    render(h(App), root)
    const f1 = document.querySelector('#f1')!
    const f2 = document.querySelector('#f2')!
    expect(f1.getAttribute('class')).toBe('foo')
    expect(f2.className).toBe('foo')

    // set a transition class on the <div> - which is only respected on non-svg
    // patches
    ;(f2 as any)._vtc = ['baz']
    cls.value = 'bar'
    await nextTick()
    expect(f1.getAttribute('class')).toBe('bar')
    expect(f2.className).toBe('bar baz')
  })
})
