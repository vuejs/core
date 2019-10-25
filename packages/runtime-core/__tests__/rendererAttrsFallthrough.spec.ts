// using DOM renderer because this case is mostly DOM-specific
import {
  h,
  render,
  nextTick,
  mergeProps,
  ref,
  onUpdated,
  createComponent
} from '@vue/runtime-dom'
import { mockWarn } from '@vue/runtime-test'

describe('attribute fallthrough', () => {
  mockWarn()

  it('everything should be in props when component has no declared props', async () => {
    const click = jest.fn()
    const childUpdated = jest.fn()

    const Hello = {
      setup() {
        const count = ref(0)

        function inc() {
          count.value++
          click()
        }

        return () =>
          h(Child, {
            foo: 1,
            id: 'test',
            class: 'c' + count.value,
            style: { color: count.value ? 'red' : 'green' },
            onClick: inc
          })
      }
    }

    const Child = {
      setup(props: any) {
        onUpdated(childUpdated)
        return () =>
          h(
            'div',
            mergeProps(
              {
                class: 'c2',
                style: { fontWeight: 'bold' }
              },
              props
            ),
            props.foo
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

  it('should implicitly fallthrough on single root nodes', async () => {
    const click = jest.fn()
    const childUpdated = jest.fn()

    const Hello = {
      setup() {
        const count = ref(0)

        function inc() {
          count.value++
          click()
        }

        return () =>
          h(Child, {
            foo: 1,
            id: 'test',
            class: 'c' + count.value,
            style: { color: count.value ? 'red' : 'green' },
            onClick: inc
          })
      }
    }

    const Child = createComponent({
      props: {
        foo: Number
      },
      setup(props) {
        onUpdated(childUpdated)
        return () =>
          h(
            'div',
            {
              class: 'c2',
              style: { fontWeight: 'bold' }
            },
            props.foo
          )
      }
    })

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

  it('should fallthrough for nested components', async () => {
    const click = jest.fn()
    const childUpdated = jest.fn()
    const grandChildUpdated = jest.fn()

    const Hello = {
      setup() {
        const count = ref(0)

        function inc() {
          count.value++
          click()
        }

        return () =>
          h(Child, {
            foo: 1,
            id: 'test',
            class: 'c' + count.value,
            style: { color: count.value ? 'red' : 'green' },
            onClick: inc
          })
      }
    }

    const Child = {
      setup(props: any) {
        onUpdated(childUpdated)
        return () => h(GrandChild, props)
      }
    }

    const GrandChild = createComponent({
      props: {
        foo: Number
      },
      setup(props) {
        onUpdated(grandChildUpdated)
        return () =>
          h(
            'div',
            {
              class: 'c2',
              style: { fontWeight: 'bold' }
            },
            props.foo
          )
      }
    })

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

  it('should not fallthrough with inheritAttrs: false', () => {
    const Parent = {
      render() {
        return h(Child, { foo: 1, class: 'parent' })
      }
    }

    const Child = createComponent({
      props: ['foo'],
      inheritAttrs: false,
      render() {
        return h('div', this.foo)
      }
    })

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    // should not contain class
    expect(root.innerHTML).toMatch(`<div>1</div>`)
  })

  it('explicit spreading with inheritAttrs: false', () => {
    const Parent = {
      render() {
        return h(Child, { foo: 1, class: 'parent' })
      }
    }

    const Child = createComponent({
      props: ['foo'],
      inheritAttrs: false,
      render() {
        return h(
          'div',
          mergeProps(
            {
              class: 'child'
            },
            this.$attrs
          ),
          this.foo
        )
      }
    })

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    // should merge parent/child classes
    expect(root.innerHTML).toMatch(`<div class="child parent">1</div>`)
  })

  it('should warn when fallthrough fails on non-single-root', () => {
    const Parent = {
      render() {
        return h(Child, { foo: 1, class: 'parent' })
      }
    }

    const Child = createComponent({
      props: ['foo'],
      render() {
        return [h('div'), h('div')]
      }
    })

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    expect(`Extraneous non-props attributes (class)`).toHaveBeenWarned()
  })

  it('should not warn when $attrs is used during render', () => {
    const Parent = {
      render() {
        return h(Child, { foo: 1, class: 'parent' })
      }
    }

    const Child = createComponent({
      props: ['foo'],
      render() {
        return [h('div'), h('div', this.$attrs)]
      }
    })

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    expect(`Extraneous non-props attributes`).not.toHaveBeenWarned()
    expect(root.innerHTML).toBe(
      `<!----><div></div><div class="parent"></div><!---->`
    )
  })
})
