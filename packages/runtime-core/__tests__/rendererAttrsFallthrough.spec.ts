// using DOM renderer because this case is mostly DOM-specific
import {
  h,
  render,
  nextTick,
  mergeProps,
  ref,
  onUpdated,
  defineComponent,
  openBlock,
  createBlock,
  FunctionalComponent,
  createCommentVNode,
  Fragment,
  withModifiers
} from '@vue/runtime-dom'
import { PatchFlags } from '@vue/shared/src'

describe('attribute fallthrough', () => {
  it('should allow attrs to fallthrough', async () => {
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
            foo: count.value + 1,
            id: 'test',
            class: 'c' + count.value,
            style: { color: count.value ? 'red' : 'green' },
            onClick: inc,
            'data-id': count.value + 1
          })
      }
    }

    const Child = {
      setup(props: any) {
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
    expect(node.dataset.id).toBe('1')
    node.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalled()

    await nextTick()
    expect(childUpdated).toHaveBeenCalled()
    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('foo')).toBe('2')
    expect(node.getAttribute('class')).toBe('c2 c1')
    expect(node.style.color).toBe('red')
    expect(node.style.fontWeight).toBe('bold')
    expect(node.dataset.id).toBe('2')
  })

  it('should only allow whitelisted fallthrough on functional component with optional props', async () => {
    const click = jest.fn()
    const childUpdated = jest.fn()

    const count = ref(0)

    function inc() {
      count.value++
      click()
    }

    const Hello = () =>
      h(Child, {
        foo: count.value + 1,
        id: 'test',
        class: 'c' + count.value,
        style: { color: count.value ? 'red' : 'green' },
        onClick: inc
      })

    const Child = (props: any) => {
      childUpdated()
      return h(
        'div',
        {
          class: 'c2',
          style: { fontWeight: 'bold' }
        },
        props.foo
      )
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Hello), root)

    const node = root.children[0] as HTMLElement

    // not whitelisted
    expect(node.getAttribute('id')).toBe(null)
    expect(node.getAttribute('foo')).toBe(null)

    // whitelisted: style, class, event listeners
    expect(node.getAttribute('class')).toBe('c2 c0')
    expect(node.style.color).toBe('green')
    expect(node.style.fontWeight).toBe('bold')
    node.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalled()

    await nextTick()
    expect(childUpdated).toHaveBeenCalled()
    expect(node.getAttribute('id')).toBe(null)
    expect(node.getAttribute('foo')).toBe(null)
    expect(node.getAttribute('class')).toBe('c2 c1')
    expect(node.style.color).toBe('red')
    expect(node.style.fontWeight).toBe('bold')
  })

  it('should allow all attrs on functional component with declared props', async () => {
    const click = jest.fn()
    const childUpdated = jest.fn()

    const count = ref(0)

    function inc() {
      count.value++
      click()
    }

    const Hello = () =>
      h(Child, {
        foo: count.value + 1,
        id: 'test',
        class: 'c' + count.value,
        style: { color: count.value ? 'red' : 'green' },
        onClick: inc
      })

    const Child = (props: { foo: number }) => {
      childUpdated()
      return h(
        'div',
        {
          class: 'c2',
          style: { fontWeight: 'bold' }
        },
        props.foo
      )
    }
    Child.props = ['foo']

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Hello), root)

    const node = root.children[0] as HTMLElement

    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('foo')).toBe(null) // declared as prop
    expect(node.getAttribute('class')).toBe('c2 c0')
    expect(node.style.color).toBe('green')
    expect(node.style.fontWeight).toBe('bold')
    node.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalled()

    await nextTick()
    expect(childUpdated).toHaveBeenCalled()
    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('foo')).toBe(null)
    expect(node.getAttribute('class')).toBe('c2 c1')
    expect(node.style.color).toBe('red')
    expect(node.style.fontWeight).toBe('bold')
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
        // HOC simply passing props down.
        // this will result in merging the same attrs, but should be deduped by
        // `mergeProps`.
        return () => h(GrandChild, props)
      }
    }

    const GrandChild = defineComponent({
      props: {
        id: String,
        foo: Number
      },
      setup(props) {
        onUpdated(grandChildUpdated)
        return () =>
          h(
            'div',
            {
              id: props.id,
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

    const Child = defineComponent({
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

  // #3741
  it('should not fallthrough with inheritAttrs: false from mixins', () => {
    const Parent = {
      render() {
        return h(Child, { foo: 1, class: 'parent' })
      }
    }

    const mixin = {
      inheritAttrs: false
    }

    const Child = defineComponent({
      mixins: [mixin],
      props: ['foo'],
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

    const Child = defineComponent({
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
        return h(Child, { foo: 1, class: 'parent', onBar: () => {} })
      }
    }

    const Child = defineComponent({
      props: ['foo'],
      render() {
        return [h('div'), h('div')]
      }
    })

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    expect(`Extraneous non-props attributes (class)`).toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).toHaveBeenWarned()
  })

  it('should dedupe same listeners when $attrs is used during render', () => {
    const click = jest.fn()
    const count = ref(0)

    function inc() {
      count.value++
      click()
    }

    const Parent = {
      render() {
        return h(Child, { onClick: inc })
      }
    }

    const Child = defineComponent({
      render() {
        return h(
          'div',
          mergeProps(
            {
              onClick: withModifiers(() => {}, ['prevent', 'stop'])
            },
            this.$attrs
          )
        )
      }
    })

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    const node = root.children[0] as HTMLElement
    node.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalledTimes(1)
    expect(count.value).toBe(1)
  })

  it('should not warn when $attrs is used during render', () => {
    const Parent = {
      render() {
        return h(Child, { foo: 1, class: 'parent', onBar: () => {} })
      }
    }

    const Child = defineComponent({
      props: ['foo'],
      render() {
        return [h('div'), h('div', this.$attrs)]
      }
    })

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    expect(`Extraneous non-props attributes`).not.toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).not.toHaveBeenWarned()

    expect(root.innerHTML).toBe(`<div></div><div class="parent"></div>`)
  })

  it('should not warn when context.attrs is used during render', () => {
    const Parent = {
      render() {
        return h(Child, { foo: 1, class: 'parent', onBar: () => {} })
      }
    }

    const Child = defineComponent({
      props: ['foo'],
      setup(_props, { attrs }) {
        return () => [h('div'), h('div', attrs)]
      }
    })

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    expect(`Extraneous non-props attributes`).not.toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).not.toHaveBeenWarned()

    expect(root.innerHTML).toBe(`<div></div><div class="parent"></div>`)
  })

  it('should not warn when context.attrs is used during render (functional)', () => {
    const Parent = {
      render() {
        return h(Child, { foo: 1, class: 'parent', onBar: () => {} })
      }
    }

    const Child: FunctionalComponent = (_, { attrs }) => [
      h('div'),
      h('div', attrs)
    ]

    Child.props = ['foo']

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    expect(`Extraneous non-props attributes`).not.toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).not.toHaveBeenWarned()
    expect(root.innerHTML).toBe(`<div></div><div class="parent"></div>`)
  })

  it('should not warn when functional component has optional props', () => {
    const Parent = {
      render() {
        return h(Child, { foo: 1, class: 'parent', onBar: () => {} })
      }
    }

    const Child = (props: any) => [h('div'), h('div', { class: props.class })]

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    expect(`Extraneous non-props attributes`).not.toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).not.toHaveBeenWarned()
    expect(root.innerHTML).toBe(`<div></div><div class="parent"></div>`)
  })

  it('should warn when functional component has props and does not use attrs', () => {
    const Parent = {
      render() {
        return h(Child, { foo: 1, class: 'parent', onBar: () => {} })
      }
    }

    const Child: FunctionalComponent = () => [h('div'), h('div')]

    Child.props = ['foo']

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    expect(`Extraneous non-props attributes`).toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).toHaveBeenWarned()
    expect(root.innerHTML).toBe(`<div></div><div></div>`)
  })

  // #677
  it('should update merged dynamic attrs on optimized child root', async () => {
    const aria = ref('true')
    const cls = ref('bar')
    const Parent = {
      render() {
        return h(Child, { 'aria-hidden': aria.value, class: cls.value })
      }
    }

    const Child = {
      props: [],
      render() {
        return openBlock(), createBlock('div')
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Parent), root)

    expect(root.innerHTML).toBe(`<div aria-hidden="true" class="bar"></div>`)

    aria.value = 'false'
    await nextTick()
    expect(root.innerHTML).toBe(`<div aria-hidden="false" class="bar"></div>`)

    cls.value = 'barr'
    await nextTick()
    expect(root.innerHTML).toBe(`<div aria-hidden="false" class="barr"></div>`)
  })

  it('should not let listener fallthrough when declared in emits (stateful)', () => {
    const Child = defineComponent({
      emits: ['click'],
      render() {
        return h(
          'button',
          {
            onClick: () => {
              this.$emit('click', 'custom')
            }
          },
          'hello'
        )
      }
    })

    const onClick = jest.fn()
    const App = {
      render() {
        return h(Child, {
          onClick
        })
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(App), root)

    const node = root.children[0] as HTMLElement
    node.dispatchEvent(new CustomEvent('click'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith('custom')
  })

  it('should not let listener fallthrough when declared in emits (functional)', () => {
    const Child: FunctionalComponent<{}, { click: any }> = (_, { emit }) => {
      // should not be in props
      expect((_ as any).onClick).toBeUndefined()
      return h('button', {
        onClick: () => {
          emit('click', 'custom')
        }
      })
    }
    Child.emits = ['click']

    const onClick = jest.fn()
    const App = {
      render() {
        return h(Child, {
          onClick
        })
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(App), root)

    const node = root.children[0] as HTMLElement
    node.dispatchEvent(new CustomEvent('click'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith('custom')
  })

  it('should support fallthrough for fragments with single element + comments', () => {
    const click = jest.fn()

    const Hello = {
      setup() {
        return () => h(Child, { class: 'foo', onClick: click })
      }
    }

    const Child = {
      setup() {
        return () => (
          openBlock(),
          createBlock(
            Fragment,
            null,
            [
              createCommentVNode('hello'),
              h('button'),
              createCommentVNode('world')
            ],
            PatchFlags.STABLE_FRAGMENT | PatchFlags.DEV_ROOT_FRAGMENT
          )
        )
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(Hello), root)

    expect(root.innerHTML).toBe(
      `<!--hello--><button class="foo"></button><!--world-->`
    )
    const button = root.children[0] as HTMLElement
    button.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalled()
  })

  // #1989
  it('should not fallthrough v-model listeners with corresponding declared prop', () => {
    let textFoo = ''
    let textBar = ''
    const click = jest.fn()

    const App = defineComponent({
      setup() {
        return () =>
          h(Child, {
            modelValue: textFoo,
            'onUpdate:modelValue': (val: string) => {
              textFoo = val
            }
          })
      }
    })

    const Child = defineComponent({
      props: ['modelValue'],
      setup(_props, { emit }) {
        return () =>
          h(GrandChild, {
            modelValue: textBar,
            'onUpdate:modelValue': (val: string) => {
              textBar = val
              emit('update:modelValue', 'from Child')
            }
          })
      }
    })

    const GrandChild = defineComponent({
      props: ['modelValue'],
      setup(_props, { emit }) {
        return () =>
          h('button', {
            onClick() {
              click()
              emit('update:modelValue', 'from GrandChild')
            }
          })
      }
    })

    const root = document.createElement('div')
    document.body.appendChild(root)
    render(h(App), root)

    const node = root.children[0] as HTMLElement

    node.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalled()
    expect(textBar).toBe('from GrandChild')
    expect(textFoo).toBe('from Child')
  })
})
