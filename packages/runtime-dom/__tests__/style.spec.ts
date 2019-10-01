import { h, render, ref, ComponentOptions } from '../src'

describe('style', () => {
  let root: HTMLDivElement

  beforeEach(() => {
    root = document.createElement('div')
  })

  function renderWithStyle(
    style: string | object | object[] | null
  ): HTMLDivElement {
    const vnode = h('div', { style })
    render(vnode, root)
    return vnode.el as HTMLDivElement
  }

  test('string', () => {
    const el = renderWithStyle('color:red;')
    expect(el.style.cssText.replace(/\s/g, '')).toBe('color:red;')
  })

  test('falsy number', () => {
    const el = renderWithStyle({ opacity: 0 })
    expect(el.style.opacity).toBe('0')
  })

  test('plain object', () => {
    const el = renderWithStyle({ color: 'red' })
    expect(el.style.cssText.replace(/\s/g, '')).toBe('color:red;')
  })

  test('camelCase', () => {
    const el = renderWithStyle({ marginRight: '10px' })
    expect(el.style.marginRight).toBe('10px')
  })

  test('remove if falsy value', () => {
    const el = renderWithStyle({ color: 'red' })
    renderWithStyle({ color: null })
    expect(el.style.color).toBe('')
  })

  test('ignore unsupported property', () => {
    const el = renderWithStyle({ foo: 'bar' })
    expect(el.style.foo).not.toBe('bar')
  })

  test('!important', () => {
    const el = renderWithStyle({ display: 'block !important' })
    expect(el.style.getPropertyPriority('display')).toBe('important')
  })

  test('camelCase with !important', () => {
    const el = renderWithStyle({ zIndex: '100 !important' })
    expect(el.style.getPropertyPriority('z-index')).toBe('important')
  })

  test('object with multiple entries', () => {
    const el = renderWithStyle({})

    el.style.color = 'red'
    renderWithStyle({ marginLeft: '10px', marginRight: '10px' })
    expect(el.style.getPropertyValue('color')).toBe('red')
    expect(el.style.getPropertyValue('margin-left')).toBe('10px')
    expect(el.style.getPropertyValue('margin-right')).toBe('15px')

    renderWithStyle({
      color: 'blue',
      padding: null
    })
    expect(el.style.getPropertyValue('color')).toBe('blue')
    expect(el.style.getPropertyValue('padding')).toBeFalsy()
    expect(el.style.getPropertyValue('margin-left')).toBeFalsy()
    expect(el.style.getPropertyValue('margin-right')).toBeFalsy()

    renderWithStyle(null)
    expect(el.style.getPropertyValue('color')).toBeFalsy()
    expect(el.style.getPropertyValue('padding')).toBeFalsy()
    expect(el.style.getPropertyValue('margin-left')).toBeFalsy()
    expect(el.style.getPropertyValue('margin-right')).toBeFalsy()
  })

  test('array of objects', () => {
    const el = renderWithStyle({})
    el.style.padding = '10px'
    renderWithStyle([{ color: 'red' }, { marginRight: '20px' }])
    expect(el.style.getPropertyValue('color')).toBe('red')
    expect(el.style.getPropertyValue('margin-right')).toBe('20px')
    expect(el.style.getPropertyValue('padding')).toBe('10px')

    renderWithStyle([{ color: 'blue' }, { padding: null }])
    expect(el.style.getPropertyValue('color')).toBe('blue')
    expect(el.style.getPropertyValue('margin-right')).toBeFalsy()
    expect(el.style.getPropertyValue('padding')).toBeFalsy()
  })

  test('updates objects deeply', () => {
    const style = { display: 'none' }
    const el = renderWithStyle(style)
    expect(el.style.display).toBe('none')
    style.display = 'block'
    renderWithStyle(style)
    expect(el.style.display).toBe('block')
  })

  test('background size with only one value', () => {
    const el = renderWithStyle({ backgroundSize: '100%' })
    expect(el.style.cssText.replace(/\s/g, '')).toMatch(
      /background-size:100%(auto)?;/
    )
  })

  const supportCssVariable = () => {
    const el = document.createElement('div')
    el.style.setProperty('--color', 'red')
    return el.style.getPropertyValue('--color') === 'red'
  }

  if (supportCssVariable()) {
    test('CSS variables', () => {
      const el = renderWithStyle({ '--color': 'red' })
      expect(el.style.getPropertyValue('--color')).toBe('red')
    })
  }

  test('should merge between parent and child', () => {
    const data = { marginLeft: '16px' }
    const child = () =>
      h('div', {
        style: [{ marginRight: '10px' }, { marginLeft: data.marginLeft }]
      })
    const test = {
      color: 'red',
      fontSize: '12px'
    }
    const parent = () =>
      h(child, {
        style: [{ textAlign: 'left', marginRight: '20px' }, test]
      })

    render(parent(), root)
    const el = root.children[0] as HTMLDivElement
    const style = el.style
    const css = style.cssText.replace(/\s/g, '')
    expect(css).toContain('margin-right:20px;')
    expect(css).toContain('margin-left:16px;')
    expect(css).toContain('text-align:left;')
    expect(css).toContain('color:red;')
    expect(css).toContain('font-size:12px;')
    expect(style.color).toBe('red')
    expect(style.marginRight).toBe('20px')

    test.color = 'blue'
    render(parent(), root)
    expect(style.color).toBe('blue')

    data.marginLeft = '30px'
    render(parent(), root)
    expect(style.marginLeft).toBe('30px')
  })

  test('should not pass to child root element', () => {
    const nested = () => h('div')
    const nestedRef = ref(null)
    const child = () =>
      h('div', [
        h(nested, {
          ref: nestedRef,
          style: { color: 'blue', textAlign: 'left' }
        })
      ])
    const wrapper = () =>
      h(child, {
        style: {
          color: 'red',
          fontSize: '12px'
        }
      })

    const vnode = h(wrapper)
    render(vnode, root)
    const el = vnode.el as HTMLDivElement
    const style = el.style
    expect(style.color).toBe('red')
    expect(style.textAlign).toBe('')
    expect(style.fontSize).toBe('12px')
    // expect(vnode.children[0].$refs.nested.el.style.color).toBe('blue')
  })

  test('should merge between nested components', () => {
    const nestedStyle: any = { marginLeft: '30px' }
    const nested = () =>
      h('div', {
        style: [{ marginLeft: '12px' }, nestedStyle]
      })

    const child = () =>
      h(nested, {
        style: {
          color: 'blue',
          textAlign: 'left'
        }
      })

    const test = { color: 'red', fontSize: '12px' }
    const wrapper = () => h(child, { style: test })

    render(wrapper(), root)
    let el = root.children[0] as HTMLDivElement
    let style = el.style
    expect(style.color).toBe('red')
    expect(style.marginLeft).toBe('30px')
    expect(style.textAlign).toBe('left')
    expect(style.fontSize).toBe('12px')

    test.color = 'yellow'
    nestedStyle.marginLeft = '60px'
    render(wrapper(), root)
    style = (root.children[0] as HTMLDivElement).style
    expect(style.marginLeft).toBe('60px')

    nestedStyle.fontSize = '14px'
    nestedStyle.marginLeft = '40px'
    render(wrapper(), root)
    style = (root.children[0] as HTMLDivElement).style
    expect(style.fontSize).toBe('12px')
    expect(style.marginLeft).toBe('40px')
  })

  test('should not merge for different adjacent elements', () => {
    const testStyle = { fontSize: '12px' }
    const data = { bool: false }
    const wrapper = () =>
      h('div', [
        !data.bool &&
          h('section', {
            style: [{ color: 'blue' }, testStyle]
          }),
        h('div'),
        data.bool &&
          h('section', {
            style: { marginTop: '12px' }
          })
      ])

    render(wrapper(), root)
    const style = (root.children[0].children[0] as HTMLElement).style
    expect(style.fontSize).toBe('12px')
    expect(style.color).toBe('blue')

    data.bool = true
    render(wrapper(), root)
    // the `section` DOM element is reused during update
    // so the `style` object can be reused for test too
    expect(style.color).toBe('')
    expect(style.fontSize).toBe('')
    expect(style.marginTop).toBe('12px')
  })

  test('should not merge for v-if, v-else-if and v-else elements', () => {
    const data = {
      foo: true,
      bar: false,
      style: {
        fontSize: '12px'
      }
    }
    const wrapper = () =>
      h('div', [
        data.foo
          ? h('section', { style: [{ color: 'blue' }, data.style] })
          : data.bar
            ? h('section', { style: { marginTop: '12px' } })
            : h('section', { style: { marginBottom: '24px' } })
      ])
    render(wrapper(), root)
    const { style } = root.children[0].children[0] as HTMLElement
    expect(style.fontSize).toBe('12px')
    expect(style.color).toBe('blue')

    data.foo = false
    render(wrapper(), root)
    expect(style.color).toBe('')
    expect(style.fontSize).toBe('')
    expect(style.marginBottom).toBe('24px')

    data.bar = true
    expect(style.color).toBe('')
    expect(style.fontSize).toBe('')
    expect(style.marginBottom).toBe('')
    expect(style.marginTop).toBe('12px')
  })

  // #5318
  test('should work for elements passed down as a slot', () => {
    const test: ComponentOptions = {
      render() {
        // FIXME: how to type this?
        return h('div', [this.$slots.default()])
      }
    }

    const style = { color: 'red' }
    const wrapper = () => h(test, [h('div', { style })])

    render(wrapper(), root)
    let el = root.children[0] as HTMLDivElement
    expect((el.children[0] as HTMLDivElement).style.color).toBe('red')

    style.color = 'green'
    render(wrapper(), root)
    el = root.children[0] as HTMLDivElement
    expect((el.children[0] as HTMLDivElement).style.color).toBe('green')
  })
})
