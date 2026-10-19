import {
  type TestElement,
  h,
  serializeInner as inner,
  nodeOps,
  render,
} from '@vue/runtime-test'

describe('renderer: element', () => {
  let root: TestElement

  beforeEach(() => {
    root = nodeOps.createElement('div')
  })

  it('should create an element', () => {
    render(h('div'), root)
    expect(inner(root)).toBe('<div></div>')
  })

  it('should create an element with props', () => {
    render(h('div', { id: 'foo', class: 'bar' }), root)
    expect(inner(root)).toBe('<div id="foo" class="bar"></div>')
  })

  it('should not render a literal "false" / "0" class', () => {
    // must agree with SSR & hydration, which normalize falsy class values to ''
    render(h('div', { class: false }, 'foo'), root)
    expect((root.children[0] as TestElement).props.class).toBe('')
    render(h('div', { class: 0 }, 'foo'), root)
    expect((root.children[0] as TestElement).props.class).toBe('')
  })

  it('should create an element with direct text children', () => {
    render(h('div', ['foo', ' ', 'bar']), root)
    expect(inner(root)).toBe('<div>foo bar</div>')
  })

  it('should create an element with direct text children and props', () => {
    render(h('div', { id: 'foo' }, ['bar']), root)
    expect(inner(root)).toBe('<div id="foo">bar</div>')
  })

  it('should update an element tag which is already mounted', () => {
    render(h('div', ['foo']), root)
    expect(inner(root)).toBe('<div>foo</div>')

    render(h('span', ['foo']), root)
    expect(inner(root)).toBe('<span>foo</span>')
  })

  it('should update element props which is already mounted', () => {
    render(h('div', { id: 'bar' }, ['foo']), root)
    expect(inner(root)).toBe('<div id="bar">foo</div>')

    render(h('div', { id: 'baz', class: 'bar' }, ['foo']), root)
    expect(inner(root)).toBe('<div id="baz" class="bar">foo</div>')
  })
})
