// MathML logic is technically dom-specific, but the logic is placed in core
// because splitting it out of core would lead to unnecessary complexity in both
// the renderer and compiler implementations.
// Related files:
// - runtime-core/src/renderer.ts
// - compiler-core/src/transforms/transformElement.ts

import { vtcKey } from '../../runtime-dom/src/components/Transition'
import { compile, h, nextTick, ref, render } from '../src'

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

  test('should match annotation-xml encoding case-insensitively', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const App = {
      // disable hoisting so children are mounted through the runtime
      // namespace resolution instead of being stringified via innerHTML
      render: compile(
        `
      <math>
        <annotation-xml encoding="TEXT/HTML">
          <div id="g1" />
        </annotation-xml>
        <annotation-xml encoding="Application/XHTML+XML">
          <div id="g2" />
        </annotation-xml>
        <annotation-xml encoding="text/xml">
          <div id="g3" />
        </annotation-xml>
        <annotation-xml encoding="text/html;charset=utf-8">
          <div id="g4" />
        </annotation-xml>
      </math>
      `,
        { hoistStatic: false },
      ),
    }
    render(h(App), root)
    expect(document.querySelector('#g1')!.namespaceURI).toMatch('xhtml')
    expect(document.querySelector('#g2')!.namespaceURI).toMatch('xhtml')
    expect(document.querySelector('#g3')!.namespaceURI).toMatch('Math')
    expect(document.querySelector('#g4')!.namespaceURI).toMatch('Math')
  })

  test('should not throw when annotation-xml encoding is not a string', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    render(
      h('math', null, [
        h('annotation-xml', { encoding: 123 }, [h('div', { id: 'h1' })]),
      ]),
      root,
    )
    expect(document.querySelector('#h1')!.namespaceURI).toMatch('Math')
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
