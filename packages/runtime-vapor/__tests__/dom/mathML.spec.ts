import { makeRender } from '../_utils'
import { template } from '../../src/dom/template'
import { child } from '../../src/dom/node'
import { setClass } from '../../src/dom/prop'
import { renderEffect } from '../../src'
import { nextTick, ref } from '@vue/runtime-dom'

const define = makeRender()

describe('MathML support', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('should mount elements with correct html namespace', () => {
    define({
      setup() {
        const t0 = template(
          '<math display="block" id="e0"><semantics id="e1"><mrow id="e2"><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mi>y</mi></mrow><annotation-xml encoding="text/html" id="e3"><div id="e4"></div><svg id="e5"></svg></annotation-xml></semantics></math>',
          true,
          2,
        )
        const n0 = t0()
        return n0
      },
    }).render()

    const e0 = document.getElementById('e0')!
    expect(e0.namespaceURI).toMatch('Math')
    expect(e0.querySelector('#e1')!.namespaceURI).toMatch('Math')
    expect(e0.querySelector('#e2')!.namespaceURI).toMatch('Math')
    expect(e0.querySelector('#e3')!.namespaceURI).toMatch('Math')
    expect(e0.querySelector('#e4')!.namespaceURI).toMatch('xhtml')
    expect(e0.querySelector('#e5')!.namespaceURI).toMatch('svg')
  })

  test('should patch elements with correct namespaces', async () => {
    const cls = ref('foo')
    define({
      setup() {
        const t0 = template(
          '<div><math id="f1"><annotation encoding="text/html"><a id="f2"></a></annotation></math></div>',
          true,
        )

        const n2 = t0() as HTMLElement
        const n1 = child(n2) as HTMLElement
        const p0 = child(n1) as HTMLElement
        const n0 = child(p0) as HTMLElement
        renderEffect(() => {
          const _cls = cls.value
          setClass(n1, _cls)
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
})
