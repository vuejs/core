// using DOM renderer because this case is mostly DOM-specific
import { h, render, Component, nextTick } from '@vue/renderer-dom'

describe('attribute fallthrough', () => {
  it('should not fallthrough on components with no declared props', async () => {
    const nativeClick = jest.fn()
    const childUpdated = jest.fn()

    class Hello extends Component {
      data() {
        return {
          count: 0
        }
      }
      inc() {
        this.count++
        nativeClick()
      }
      render() {
        return h(Child, {
          foo: 1,
          id: 'test',
          class: 'c' + this.count,
          style: { color: this.count ? 'red' : 'green' },
          nativeOnClick: this.inc
        })
      }
    }

    class Child extends Component {
      updated() {
        childUpdated()
      }
      render() {
        return h(
          'div',
          {
            class: 'c2',
            style: { fontWeight: 'bold' }
          },
          this.$props.foo
        )
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Hello), root)

    const node = root.children[0] as HTMLElement

    // attrs do not fallthrough because no props are declared
    expect(node.hasAttribute('id')).toBe(false)
    expect(node.hasAttribute('foo')).toBe(false)

    // class, style and nativeOn* always fallthrough
    expect(node.getAttribute('class')).toBe('c2 c0')
    expect(node.style.color).toBe('green')
    expect(node.style.fontWeight).toBe('bold')
    node.dispatchEvent(new CustomEvent('click'))
    expect(nativeClick).toHaveBeenCalled()

    await nextTick()
    expect(childUpdated).toHaveBeenCalled()
    expect(node.hasAttribute('id')).toBe(false)
    expect(node.hasAttribute('foo')).toBe(false)
    expect(node.getAttribute('class')).toBe('c2 c1')
    expect(node.style.color).toBe('red')
    expect(node.style.fontWeight).toBe('bold')
  })

  it('should fallthrough on components with declared props', async () => {
    const nativeClick = jest.fn()
    const childUpdated = jest.fn()

    class Hello extends Component {
      data() {
        return {
          count: 0
        }
      }
      inc() {
        this.count++
        nativeClick()
      }
      render() {
        return h(Child, {
          foo: 1,
          id: 'test',
          class: 'c' + this.count,
          style: { color: this.count ? 'red' : 'green' },
          nativeOnClick: this.inc
        })
      }
    }

    class Child extends Component {
      static options = {
        props: {
          foo: Number
        }
      }
      updated() {
        childUpdated()
      }
      render() {
        return h(
          'div',
          {
            class: 'c2',
            style: { fontWeight: 'bold' }
          },
          this.$props.foo
        )
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Hello), root)

    const node = root.children[0] as HTMLElement

    // with declared props, any parent attr that isn't a prop falls through
    expect(node.getAttribute('id')).toBe('test')
    // ...while declared ones remain props
    expect(node.hasAttribute('foo')).toBe(false)

    // class, style and nativeOn* always fallthrough
    expect(node.getAttribute('class')).toBe('c2 c0')
    expect(node.style.color).toBe('green')
    expect(node.style.fontWeight).toBe('bold')
    node.dispatchEvent(new CustomEvent('click'))
    expect(nativeClick).toHaveBeenCalled()

    await nextTick()
    expect(childUpdated).toHaveBeenCalled()
    expect(node.getAttribute('id')).toBe('test')
    expect(node.hasAttribute('foo')).toBe(false)
    expect(node.getAttribute('class')).toBe('c2 c1')
    expect(node.style.color).toBe('red')
    expect(node.style.fontWeight).toBe('bold')
  })

  it('should fallthrough on multi-nested components', async () => {
    const nativeClick = jest.fn()
    const childUpdated = jest.fn()
    const grandChildUpdated = jest.fn()

    class Hello extends Component {
      data() {
        return {
          count: 0
        }
      }
      inc() {
        this.count++
        nativeClick()
      }
      render() {
        return h(Child, {
          foo: 1,
          id: 'test',
          class: 'c' + this.count,
          style: { color: this.count ? 'red' : 'green' },
          nativeOnClick: this.inc
        })
      }
    }

    class Child extends Component {
      static options = {
        props: {
          foo: Number
        }
      }
      updated() {
        childUpdated()
      }
      render(props: any) {
        return h(GrandChild, props)
      }
    }

    class GrandChild extends Component {
      static options = {
        props: {
          foo: Number
        }
      }
      updated() {
        grandChildUpdated()
      }
      render(props: any) {
        return h(
          'div',
          {
            class: 'c2',
            style: { fontWeight: 'bold' }
          },
          props.foo
        )
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Hello), root)

    const node = root.children[0] as HTMLElement

    // with declared props, any parent attr that isn't a prop falls through
    expect(node.getAttribute('id')).toBe('test')
    // ...while declared ones remain props
    expect(node.hasAttribute('foo')).toBe(false)

    // class, style and nativeOn* always fallthrough
    expect(node.getAttribute('class')).toBe('c2 c0')
    expect(node.style.color).toBe('green')
    expect(node.style.fontWeight).toBe('bold')
    node.dispatchEvent(new CustomEvent('click'))
    expect(nativeClick).toHaveBeenCalled()

    await nextTick()
    expect(childUpdated).toHaveBeenCalled()
    expect(grandChildUpdated).toHaveBeenCalled()
    expect(node.getAttribute('id')).toBe('test')
    expect(node.hasAttribute('foo')).toBe(false)
    expect(node.getAttribute('class')).toBe('c2 c1')
    expect(node.style.color).toBe('red')
    expect(node.style.fontWeight).toBe('bold')
  })
})
