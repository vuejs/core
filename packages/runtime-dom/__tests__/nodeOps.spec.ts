import { nodeOps, svgNS } from '../src/nodeOps'

describe('runtime-dom: node-ops', () => {
  test('the _value property should be cloned', () => {
    const el = nodeOps.createElement('input') as HTMLDivElement & {
      _value: any
    }
    el._value = 1
    const cloned = nodeOps.cloneNode!(el) as HTMLDivElement & { _value: any }
    expect(cloned._value).toBe(1)
  })

  test("the <select>'s multiple attr should be set in createElement", () => {
    const el = nodeOps.createElement('select', false, undefined, {
      multiple: ''
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

  test("the <input>'s value, checked attrs should be set in createElement", () => {
    const value = 'foo'
    const checked = true

    const el = nodeOps.createElement('input', false, undefined, {
      value,
      checked
    }) as HTMLInputElement

    el.value = value + value
    el.checked = !checked

    expect(el.getAttribute('value')).toBe(value)
    expect(el.getAttribute('checked')).toBe('')
  })

  test("the <option>'s selected attr should be set in createElement", () => {
    const el = nodeOps.createElement('option', false, undefined, {
      selected: true
    }) as HTMLOptionElement

    el.selected = false

    expect(el.getAttribute('selected')).toBe('')
  })

  describe('insertStaticContent', () => {
    test('fresh insertion', () => {
      const content = `<div>one</div><div>two</div>three`
      const parent = document.createElement('div')
      const nodes = nodeOps.insertStaticContent!(content, parent, null, false)
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
      const nodes = nodeOps.insertStaticContent!(content, parent, anchor, false)
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
        true
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
        true
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
        false,
        cached.firstChild,
        cached.lastChild
      )
      expect(parent.innerHTML).toBe(content + existing)
      expect(nodes[0]).toBe(parent.firstChild)
      expect(nodes[1]).toBe(parent.childNodes[parent.childNodes.length - 2])
    })
  })
})
