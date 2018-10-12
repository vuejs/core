// using DOM renderer because this case is mostly DOM-specific
import { h, render, Component, nextTick, cloneVNode } from '@vue/renderer-dom'

describe('attribute fallthrough', () => {
  it('everything should be in props when component has no declared props', async () => {
    const click = jest.fn()
    const childUpdated = jest.fn()

    class Hello extends Component {
      count: number = 0
      inc() {
        this.count++
        click()
      }
      render() {
        return h(Child, {
          foo: 1,
          id: 'test',
          class: 'c' + this.count,
          style: { color: this.count ? 'red' : 'green' },
          onClick: this.inc
        })
      }
    }

    class Child extends Component<{ [key: string]: any }> {
      updated() {
        childUpdated()
      }
      render(props: any) {
        return cloneVNode(
          h(
            'div',
            {
              class: 'c2',
              style: { fontWeight: 'bold' }
            },
            props.foo
          ),
          props
        )
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Hello), root)

    const node = root.children[0] as HTMLElement

    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('foo')).toBe('1')
    expect(node.getAttribute('class')).toBe('c2 c0')
    expect(node.style.color).toBe('green')
    expect(node.style.fontWeight).toBe('bold')
    node.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalled()

    await nextTick()
    expect(childUpdated).toHaveBeenCalled()
    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('foo')).toBe('1')
    expect(node.getAttribute('class')).toBe('c2 c1')
    expect(node.style.color).toBe('red')
    expect(node.style.fontWeight).toBe('bold')
  })

  it('should separate in attrs when component has declared props', async () => {
    const click = jest.fn()
    const childUpdated = jest.fn()

    class Hello extends Component {
      count = 0
      inc() {
        this.count++
        click()
      }
      render() {
        return h(Child, {
          foo: 123,
          id: 'test',
          class: 'c' + this.count,
          style: { color: this.count ? 'red' : 'green' },
          onClick: this.inc
        })
      }
    }

    class Child extends Component<{ [key: string]: any; foo: number }> {
      static props = {
        foo: Number
      }
      updated() {
        childUpdated()
      }
      render() {
        return cloneVNode(
          h(
            'div',
            {
              class: 'c2',
              style: { fontWeight: 'bold' }
            },
            this.$props.foo
          ),
          this.$attrs
        )
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Hello), root)

    const node = root.children[0] as HTMLElement

    // with declared props, any parent attr that isn't a prop falls through
    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('class')).toBe('c2 c0')
    expect(node.style.color).toBe('green')
    expect(node.style.fontWeight).toBe('bold')
    node.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalled()

    // ...while declared ones remain props
    expect(node.hasAttribute('foo')).toBe(false)

    await nextTick()
    expect(childUpdated).toHaveBeenCalled()
    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('class')).toBe('c2 c1')
    expect(node.style.color).toBe('red')
    expect(node.style.fontWeight).toBe('bold')

    expect(node.hasAttribute('foo')).toBe(false)
  })

  it('should fallthrough on multi-nested components', async () => {
    const click = jest.fn()
    const childUpdated = jest.fn()
    const grandChildUpdated = jest.fn()

    class Hello extends Component {
      count = 0
      inc() {
        this.count++
        click()
      }
      render() {
        return h(Child, {
          foo: 1,
          id: 'test',
          class: 'c' + this.count,
          style: { color: this.count ? 'red' : 'green' },
          onClick: this.inc
        })
      }
    }

    class Child extends Component<{ [key: string]: any; foo: number }> {
      updated() {
        childUpdated()
      }
      render() {
        return h(GrandChild, this.$props)
      }
    }

    class GrandChild extends Component<{ [key: string]: any; foo: number }> {
      static props = {
        foo: Number
      }
      updated() {
        grandChildUpdated()
      }
      render(props: any) {
        return cloneVNode(
          h(
            'div',
            {
              class: 'c2',
              style: { fontWeight: 'bold' }
            },
            props.foo
          ),
          this.$attrs
        )
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Hello), root)

    const node = root.children[0] as HTMLElement

    // with declared props, any parent attr that isn't a prop falls through
    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('class')).toBe('c2 c0')
    expect(node.style.color).toBe('green')
    expect(node.style.fontWeight).toBe('bold')
    node.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalled()

    // ...while declared ones remain props
    expect(node.hasAttribute('foo')).toBe(false)

    await nextTick()
    expect(childUpdated).toHaveBeenCalled()
    expect(grandChildUpdated).toHaveBeenCalled()
    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('class')).toBe('c2 c1')
    expect(node.style.color).toBe('red')
    expect(node.style.fontWeight).toBe('bold')

    expect(node.hasAttribute('foo')).toBe(false)
  })
})
