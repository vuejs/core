import { defineComponent, h, nextTick, ref } from 'vue'
import { mathmlNS, nodeOps, svgNS } from '../src/nodeOps'
import { render } from '@vue/runtime-dom'
describe('runtime-dom: node-ops', () => {
  test("the <select>'s multiple attr should be set in createElement", () => {
    const el = nodeOps.createElement('select', undefined, undefined, {
      multiple: '',
    }) as HTMLSelectElement
    const option1 = nodeOps.createElement('option') as HTMLOptionElement
    const option2 = nodeOps.createElement('option') as HTMLOptionElement
    option1.selected = true
    option2.selected = true
    nodeOps.insert(option1, el)
    nodeOps.insert(option2, el)

    expect(el.multiple).toBe(true)
    expect(option1.selected).toBe(true)
    expect(option2.selected).toBe(true)
  })

  // #6272
  test('children of a <template> element are inserted into its content', () => {
    const el = nodeOps.createElement('template') as HTMLTemplateElement
    const child = nodeOps.createElement('span')
    nodeOps.insert(child, el)

    expect(el.childNodes.length).toBe(0)
    expect(el.content.childNodes.length).toBe(1)
    expect(el.content.firstChild).toBe(child)

    const anchor = child
    const before = nodeOps.createElement('div')
    nodeOps.insert(before, el, anchor)
    expect(el.content.firstChild).toBe(before)
    expect(el.content.childNodes.length).toBe(2)
  })

  // #6272
  test('rendered <template> element retains its content', () => {
    const root = document.createElement('div')
    render(h('template', null, [h('span', 'hi')]), root)
    const template = root.firstChild as HTMLTemplateElement
    expect(template.tagName).toBe('TEMPLATE')
    expect(template.content.childNodes.length).toBe(1)
    expect(template.innerHTML).toBe('<span>hi</span>')
  })

  test('create custom elements', () => {
    const spyCreateElement = vi.spyOn(document, 'createElement')

    nodeOps.createElement('custom-element')
    expect(spyCreateElement).toHaveBeenLastCalledWith('custom-element')

    nodeOps.createElement('custom-element', undefined, 'li')
    expect(spyCreateElement).toHaveBeenLastCalledWith('custom-element', {
      is: 'li',
    })

    spyCreateElement.mockClear()
  })

  describe('insertStaticContent', () => {
    test('fresh insertion', () => {
      const content = `<div>one</div><div>two</div>three`
      const parent = document.createElement('div')
      const nodes = nodeOps.insertStaticContent!(
        content,
        parent,
        null,
        undefined,
      )
      expect(parent.innerHTML).toBe(content)
      expect(nodes[0]).toBe(parent.firstChild)
      expect(nodes[1]).toBe(parent.lastChild)
    })

    test('fresh insertion with anchor', () => {
      const content = `<div>one</div><div>two</div>three`
      const existing = `<div>existing</div>`
      const parent = document.createElement('div')
      parent.innerHTML = existing
      const anchor = parent.firstChild
      const nodes = nodeOps.insertStaticContent!(
        content,
        parent,
        anchor,
        undefined,
      )
      expect(parent.innerHTML).toBe(content + existing)
      expect(nodes[0]).toBe(parent.firstChild)
      expect(nodes[1]).toBe(parent.childNodes[parent.childNodes.length - 2])
    })

    test('fresh insertion as svg', () => {
      const content = `<text>hello</text><circle cx="100" cy="100" r="80"></circle>`
      const parent = document.createElementNS(svgNS, 'svg')
      const [first, last] = nodeOps.insertStaticContent!(
        content,
        parent,
        null,
        'svg',
      )
      expect(parent.innerHTML).toBe(content)
      expect(first).toBe(parent.firstChild)
      expect(last).toBe(parent.lastChild)
      expect((first as Element).namespaceURI).toMatch('svg')
      expect((last as Element).namespaceURI).toMatch('svg')
    })

    test('fresh insertion as svg, with anchor', () => {
      const content = `<text>hello</text><circle cx="100" cy="100" r="80"></circle>`
      const existing = `<path></path>`
      const parent = document.createElementNS(svgNS, 'svg')
      parent.innerHTML = existing
      const anchor = parent.firstChild
      const [first, last] = nodeOps.insertStaticContent!(
        content,
        parent,
        anchor,
        'svg',
      )
      expect(parent.innerHTML).toBe(content + existing)
      expect(first).toBe(parent.firstChild)
      expect(last).toBe(parent.childNodes[parent.childNodes.length - 2])
      expect((first as Element).namespaceURI).toMatch('svg')
      expect((last as Element).namespaceURI).toMatch('svg')
    })

    test('cached insertion', () => {
      const content = `<div>one</div><div>two</div>three`
      const existing = `<div>existing</div>`
      const parent = document.createElement('div')
      parent.innerHTML = existing
      const anchor = parent.firstChild

      const cached = document.createElement('div')
      cached.innerHTML = content

      const nodes = nodeOps.insertStaticContent!(
        content,
        parent,
        anchor,
        undefined,
        cached.firstChild,
        cached.lastChild,
      )
      expect(parent.innerHTML).toBe(content + existing)
      expect(nodes[0]).toBe(parent.firstChild)
      expect(nodes[1]).toBe(parent.childNodes[parent.childNodes.length - 2])
    })

    // #6272 static content under a <template> must land in its content fragment
    test('fresh insertion into a <template> parent uses its content', () => {
      const content = `<div>one</div><div>two</div>three`
      const parent = document.createElement('template') as HTMLTemplateElement
      const [first, last] = nodeOps.insertStaticContent!(
        content,
        parent,
        null,
        undefined,
      )
      // nothing should be appended to the template element itself
      expect(parent.childNodes.length).toBe(0)
      expect(parent.content.childNodes.length).toBe(3)
      expect(parent.innerHTML).toBe(content)
      expect(first).toBe(parent.content.firstChild)
      expect(last).toBe(parent.content.lastChild)
    })

    test('cached insertion into a <template> parent uses its content', () => {
      const content = `<div>one</div><div>two</div>three`
      const parent = document.createElement('template') as HTMLTemplateElement

      const cached = document.createElement('div')
      cached.innerHTML = content

      const [first, last] = nodeOps.insertStaticContent!(
        content,
        parent,
        null,
        undefined,
        cached.firstChild,
        cached.lastChild,
      )
      expect(parent.childNodes.length).toBe(0)
      expect(parent.content.childNodes.length).toBe(3)
      expect(parent.innerHTML).toBe(content)
      expect(first).toBe(parent.content.firstChild)
      expect(last).toBe(parent.content.lastChild)
    })

    test('The math elements should keep their MathML namespace', async () => {
      let root = document.createElement('div') as any

      let countRef: any
      const component = defineComponent({
        data() {
          return { value: 0 }
        },
        setup() {
          const count = ref(0)
          countRef = count
          return {
            count,
          }
        },
        template: `
          <div>
            <math>
              <mrow class="bar" v-if="count % 2">Bar</mrow>
              <msup class="foo" v-else>Foo</msup>
            </math>
          </div>
        `,
      })
      render(h(component), root)
      const foo = root.querySelector('.foo')
      expect(foo.namespaceURI).toBe(mathmlNS)
      countRef.value++
      await nextTick()
      const bar = root.querySelector('.bar')
      expect(bar.namespaceURI).toBe(mathmlNS)
    })
  })
})
