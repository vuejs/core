// MathML logic is technically dom-specific, but the logic is placed in core
// because splitting it out of core would lead to unnecessary complexity in both
// the renderer and compiler implementations.
// Related files:
// - runtime-core/src/renderer.ts
// - compiler-core/src/transforms/transformElement.ts

import { vtcKey } from '../../runtime-dom/src/components/Transition'
import { h, nextTick, ref, render } from '../src'

describe('MathML support', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('should mount elements with correct html namespace', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const App = {
      template: `
      <math display="block" id="e0">
        <semantics id="e1">
          <mrow id="e2">
            <msup>
              <mi>x</mi>
              <mn>2</mn>
            </msup>
            <mo>+</mo>
            <mi>y</mi>
          </mrow>

          <annotation-xml encoding="text/html" id="e3">
            <div id="e4" />
            <svg id="e5" />
          </annotation-xml>
        </semantics>
      </math>
      `,
    }
    render(h(App), root)
    const e0 = document.getElementById('e0')!
    expect(e0.namespaceURI).toMatch('Math')
    expect(e0.querySelector('#e1')!.namespaceURI).toMatch('Math')
    expect(e0.querySelector('#e2')!.namespaceURI).toMatch('Math')
    expect(e0.querySelector('#e3')!.namespaceURI).toMatch('Math')
    expect(e0.querySelector('#e4')!.namespaceURI).toMatch('xhtml')
    expect(e0.querySelector('#e5')!.namespaceURI).toMatch('svg')
  })

  test('should patch elements with correct namespaces', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cls = ref('foo')
    const App = {
      setup: () => ({ cls }),
      template: `
        <div>
          <math id="f1" :class="cls">
            <annotation encoding="text/html">
              <div id="f2" :class="cls"/>
            </annotation>
          </math>
        </div>
      `,
    }
    render(h(App), root)
    const f1 = document.querySelector('#f1')!
    const f2 = document.querySelector('#f2')!
    expect(f1.getAttribute('class')).toBe('foo')
    expect(f2.className).toBe('foo')

    // set a transition class on the <div> - which is only respected on non-svg
    // patches
    ;(f2 as any)[vtcKey] = ['baz']
    cls.value = 'bar'
    await nextTick()
    expect(f1.getAttribute('class')).toBe('bar')
    expect(f2.className).toBe('bar baz')
  })
})
