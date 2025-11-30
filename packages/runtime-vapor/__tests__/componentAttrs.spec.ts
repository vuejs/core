import {
  type Ref,
  nextTick,
  onUpdated,
  ref,
  withModifiers,
} from '@vue/runtime-dom'
import {
  VaporTeleport,
  createComponent,
  createDynamicComponent,
  createIf,
  createSlot,
  defineVaporComponent,
  delegateEvents,
  renderEffect,
  setClass,
  setDynamicProps,
  setProp,
  setStyle,
  template,
  withVaporCtx,
} from '../src'
import { makeRender } from './_utils'
import { stringifyStyle } from '@vue/shared'
import { setElementText } from '../src/dom/prop'

const define = makeRender<any>()
delegateEvents('click')

describe('attribute fallthrough', () => {
  it('should allow attrs to fallthrough', async () => {
    const t0 = template('<div>', true)
    const { component: Child } = define({
      props: ['foo'],
      setup(props: any) {
        const n0 = t0() as Element
        renderEffect(() => setElementText(n0, props.foo))
        return n0
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { host } = define({
      setup() {
        return createComponent(
          Child,
          {
            foo: () => foo.value,
            id: () => id.value,
          },
          null,
          true,
        )
      },
    }).render()
    expect(host.innerHTML).toBe('<div id="a">1</div>')

    foo.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div id="a">2</div>')

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div id="b">2</div>')
  })

  it('should only allow whitelisted fallthrough on functional component with optional props', async () => {
    const click = vi.fn()
    const childUpdated = vi.fn()

    const count = ref(0)

    function inc() {
      count.value++
      click()
    }

    const Hello = () =>
      createComponent(Child, {
        foo: () => count.value + 1,
        id: () => 'test',
        class: () => 'c' + count.value,
        style: () => ({
          color: count.value ? 'red' : 'green',
        }),
        onClick: () => inc,
      })

    const { component: Child } = define((props: any) => {
      childUpdated()
      const n0 = template(
        '<div class="c2" style="font-weight: bold"></div>',
        true,
      )() as Element
      renderEffect(() => setElementText(n0, props.foo))
      return n0
    })

    const { host: root } = define(Hello).render()
    expect(root.innerHTML).toBe(
      '<div class="c2 c0" style="font-weight: bold; color: green;">1</div>',
    )

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
    const click = vi.fn()
    const childUpdated = vi.fn()

    const count = ref(0)

    function inc() {
      count.value++
      click()
    }

    const Hello = () =>
      createComponent(Child, {
        foo: () => count.value + 1,
        id: () => 'test',
        class: () => 'c' + count.value,
        style: () => ({ color: count.value ? 'red' : 'green' }),
        onClick: () => inc,
      })

    const Child = defineVaporComponent((props: any) => {
      childUpdated()
      const n0 = template(
        '<div class="c2" style="font-weight: bold"></div>',
        true,
      )() as Element
      renderEffect(() => setElementText(n0, props.foo))
      return n0
    })

    Child.props = ['foo']

    const { host: root } = define(Hello).render()
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
    const click = vi.fn()
    const childUpdated = vi.fn()
    const grandChildUpdated = vi.fn()

    const Hello = {
      setup() {
        const count = ref(0)

        function inc() {
          count.value++
          click()
        }

        return createComponent(Child, {
          foo: () => count.value + 1,
          id: () => 'test',
          class: () => 'c' + count.value,
          style: () => ({
            color: count.value ? 'red' : 'green',
          }),
          onClick: () => inc,
        })
      },
    }

    const Child = defineVaporComponent({
      setup(props: any) {
        onUpdated(childUpdated)
        // HOC simply passing props down.
        // this will result in merging the same attrs, but should be deduped by
        // `mergeProps`.
        return createComponent(GrandChild, props, null, true)
      },
    })

    const GrandChild = defineVaporComponent({
      props: {
        id: String,
        foo: Number,
      },
      setup(props) {
        onUpdated(grandChildUpdated)
        const n0 = template(
          '<div class="c2" style="font-weight: bold"></div>',
          true,
        )() as Element
        renderEffect(() => {
          setProp(n0, 'id', props.id)
          setElementText(n0, props.foo)
        })
        return n0
      },
    })

    const { host: root } = define(Hello).render()
    expect(root.innerHTML).toBe(
      '<div class="c2 c0" style="font-weight: bold; color: green;" id="test">1</div>',
    )

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
    // child should not update, due to it not accessing props
    // this is a optimization in vapor mode
    expect(childUpdated).not.toHaveBeenCalled()
    expect(grandChildUpdated).toHaveBeenCalled()
    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('class')).toBe('c2 c1')
    expect(node.style.color).toBe('red')
    expect(node.style.fontWeight).toBe('bold')

    expect(node.hasAttribute('foo')).toBe(false)
  })

  it('should not fallthrough with inheritAttrs: false', () => {
    const Parent = defineVaporComponent({
      setup() {
        return createComponent(Child, { foo: () => 1, class: () => 'parent' })
      },
    })

    const Child = defineVaporComponent({
      props: ['foo'],
      inheritAttrs: false,
      setup(props) {
        const n0 = template('<div></div>', true)() as Element
        renderEffect(() => setElementText(n0, props.foo))
        return n0
      },
    })

    const { html } = define(Parent).render()

    // should not contain class
    expect(html()).toMatch(`<div>1</div>`)
  })

  it('explicit spreading with inheritAttrs: false', () => {
    const Parent = defineVaporComponent({
      setup() {
        return createComponent(Child, { foo: () => 1, class: () => 'parent' })
      },
    })

    const Child = defineVaporComponent({
      props: ['foo'],
      inheritAttrs: false,
      setup(props, { attrs }) {
        const n0 = template('<div>', true)() as Element
        renderEffect(() => {
          setElementText(n0, props.foo)
          setDynamicProps(n0, [{ class: 'child' }, attrs])
        })
        return n0
      },
    })

    const { html } = define(Parent).render()

    // should merge parent/child classes
    expect(html()).toMatch(`<div class="child parent">1</div>`)
  })

  it('should warn when fallthrough fails on non-single-root', () => {
    const Parent = {
      setup() {
        return createComponent(Child, {
          foo: () => 1,
          class: () => 'parent',
          onBar: () => () => {},
        })
      },
    }

    const Child = defineVaporComponent({
      props: ['foo'],
      render() {
        return [template('<div></div>')(), template('<div></div>')()]
      },
    })

    define(Parent).render()

    expect(`Extraneous non-props attributes (class)`).toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).toHaveBeenWarned()
  })

  it('should warn when fallthrough fails on teleport root node', () => {
    const Parent = {
      render() {
        return createComponent(Child, { class: () => 'parent' })
      },
    }

    const root = document.createElement('div')
    const Child = defineVaporComponent({
      render() {
        return createComponent(
          VaporTeleport,
          { to: () => root },
          {
            default: () => template('<div></div>')(),
          },
        )
      },
    })

    document.body.appendChild(root)
    define(Parent).render()

    expect(`Extraneous non-props attributes (class)`).toHaveBeenWarned()
  })

  it('should dedupe same listeners when $attrs is used during render', () => {
    const click = vi.fn()
    const count = ref(0)

    function inc() {
      count.value++
      click()
    }

    const Parent = {
      render() {
        return createComponent(Child, { onClick: () => inc })
      },
    }

    const Child = defineVaporComponent({
      setup(_, { attrs }) {
        const n0 = template('<div></div>', true)() as any
        n0.$evtclick = withModifiers(() => {}, ['prevent', 'stop'])
        renderEffect(() => setDynamicProps(n0, [attrs]))
        return n0
      },
    })

    const { host } = define(Parent).render()
    const node = host.children[0] as HTMLElement
    node.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalledTimes(1)
    expect(count.value).toBe(1)
  })

  it('should not warn when context.attrs is used during render', () => {
    const Parent = {
      render() {
        return createComponent(Child, {
          foo: () => 1,
          class: () => 'parent',
          onBar: () => () => {},
        })
      },
    }

    const Child = defineVaporComponent({
      props: ['foo'],
      render(_ctx, $props, $emit, $attrs, $slots) {
        const n0 = template('<div></div>')() as Element
        const n1 = template('<div></div>')() as Element
        renderEffect(() => {
          setDynamicProps(n1, [$attrs])
        })
        return [n0, n1]
      },
    })

    const { html } = define(Parent).render()

    expect(`Extraneous non-props attributes`).not.toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).not.toHaveBeenWarned()

    expect(html()).toBe(`<div></div><div class="parent"></div>`)
  })

  it('should not warn when context.attrs is used during render (functional)', () => {
    const Parent = {
      render() {
        return createComponent(Child, {
          foo: () => 1,
          class: () => 'parent',
          onBar: () => () => {},
        })
      },
    }

    const { component: Child } = define((_: any, { attrs }: any) => {
      const n0 = template('<div></div>')() as Element
      const n1 = template('<div></div>')() as Element
      renderEffect(() => {
        setDynamicProps(n1, [attrs])
      })
      return [n0, n1]
    })

    Child.props = ['foo']

    const { html } = define(Parent).render()

    expect(`Extraneous non-props attributes`).not.toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).not.toHaveBeenWarned()
    expect(html()).toBe(`<div></div><div class="parent"></div>`)
  })

  it('should not warn when functional component has optional props', () => {
    const Parent = {
      render() {
        return createComponent(Child, {
          foo: () => 1,
          class: () => 'parent',
          onBar: () => () => {},
        })
      },
    }

    const { component: Child } = define((props: any) => {
      const n0 = template('<div></div>')() as Element
      const n1 = template('<div></div>')() as Element
      renderEffect(() => {
        setClass(n1, props.class)
      })
      return [n0, n1]
    })

    const root = document.createElement('div')
    document.body.appendChild(root)
    const { html } = define(Parent).render()

    expect(`Extraneous non-props attributes`).not.toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).not.toHaveBeenWarned()
    expect(html()).toBe(`<div></div><div class="parent"></div>`)
  })

  it('should warn when functional component has props and does not use attrs', () => {
    const Parent = {
      render() {
        return createComponent(Child, {
          foo: () => 1,
          class: () => 'parent',
          onBar: () => () => {},
        })
      },
    }

    const { component: Child } = define(() => [
      template('<div></div>')(),
      template('<div></div>')(),
    ])

    Child.props = ['foo']

    const { html } = define(Parent).render()

    expect(`Extraneous non-props attributes`).toHaveBeenWarned()
    expect(`Extraneous non-emits event listeners`).toHaveBeenWarned()
    expect(html()).toBe(`<div></div><div></div>`)
  })

  it('should not let listener fallthrough when declared in emits (stateful)', () => {
    const Child = defineVaporComponent({
      emits: ['click'],
      render(_ctx, $props, $emit, $attrs, $slots) {
        const n0 = template('<button>hello</button>')() as any
        n0.$evtclick = () => {
          // @ts-expect-error
          $emit('click', 'custom')
        }
        return n0
      },
    })

    const onClick = vi.fn()
    const App = defineVaporComponent({
      render() {
        return createComponent(
          Child,
          {
            onClick: () => onClick,
          },
          null,
          true,
        )
      },
    })

    const { host: root } = define(App).render()
    const node = root.children[0] as HTMLElement
    node.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith('custom')
  })

  it('should not let listener fallthrough when declared in emits (functional)', () => {
    const { component: Child } = define((_: any, { emit }: any) => {
      // should not be in props
      expect((_ as any).onClick).toBeUndefined()
      const n0 = template('<button></button>')() as any
      n0.$evtclick = () => {
        emit('click', 'custom')
      }
      return n0
    })
    Child.emits = ['click']

    const onClick = vi.fn()
    const App = defineVaporComponent({
      render() {
        return createComponent(Child, {
          onClick: () => onClick,
        })
      },
    })

    const { host: root } = define(App).render()
    const node = root.children[0] as HTMLElement
    node.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith('custom')
  })

  it('should support fallthrough for single element + comments', () => {
    const click = vi.fn()

    const Hello = defineVaporComponent({
      render() {
        return createComponent(Child, {
          class: () => 'foo',
          onClick: () => click,
        })
      },
    })

    const Child = defineVaporComponent({
      render() {
        return [
          template('<!--hello-->')(),
          template('<button></button>')(),
          template('<!--world-->')(),
        ]
      },
    })

    const { host: root } = define(Hello).render()

    expect(root.innerHTML).toBe(
      `<!--hello--><button class="foo"></button><!--world-->`,
    )
    const button = root.children[0] as HTMLElement
    button.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalled()
  })

  // it('should support fallthrough for nested dev root fragments', async () => {
  //   const toggle = ref(false)

  //   const Child = {
  //     setup() {
  //       return () => (
  //         openBlock(),
  //         createElementBlock(
  //           Fragment,
  //           null,
  //           [
  //             createCommentVNode(' comment A '),
  //             toggle.value
  //               ? (openBlock(), createElementBlock('span', { key: 0 }, 'Foo'))
  //               : (openBlock(),
  //                 createElementBlock(
  //                   Fragment,
  //                   { key: 1 },
  //                   [
  //                     createCommentVNode(' comment B '),
  //                     createElementVNode('div', null, 'Bar'),
  //                   ],
  //                   PatchFlags.STABLE_FRAGMENT | PatchFlags.DEV_ROOT_FRAGMENT,
  //                 )),
  //           ],
  //           PatchFlags.STABLE_FRAGMENT | PatchFlags.DEV_ROOT_FRAGMENT,
  //         )
  //       )
  //     },
  //   }

  //   const Root = {
  //     setup() {
  //       return () => (openBlock(), createBlock(Child, { class: 'red' }))
  //     },
  //   }

  //   const root = document.createElement('div')
  //   document.body.appendChild(root)
  //   render(h(Root), root)

  //   expect(root.innerHTML).toBe(
  //     `<!-- comment A --><!-- comment B --><div class="red">Bar</div>`,
  //   )

  //   toggle.value = true
  //   await nextTick()
  //   expect(root.innerHTML).toBe(
  //     `<!-- comment A --><span class=\"red\">Foo</span>`,
  //   )
  // })

  // // #1989
  // it('should not fallthrough v-model listeners with corresponding declared prop', () => {
  //   let textFoo = ''
  //   let textBar = ''
  //   const click = vi.fn()

  //   const App = defineVaporComponent({
  //     setup() {
  //       return () =>
  //         h(Child, {
  //           modelValue: textFoo,
  //           'onUpdate:modelValue': (val: string) => {
  //             textFoo = val
  //           },
  //         })
  //     },
  //   })

  //   const Child = defineVaporComponent({
  //     props: ['modelValue'],
  //     setup(_props, { emit }) {
  //       return () =>
  //         h(GrandChild, {
  //           modelValue: textBar,
  //           'onUpdate:modelValue': (val: string) => {
  //             textBar = val
  //             emit('update:modelValue', 'from Child')
  //           },
  //         })
  //     },
  //   })

  //   const GrandChild = defineVaporComponent({
  //     props: ['modelValue'],
  //     setup(_props, { emit }) {
  //       return () =>
  //         h('button', {
  //           onClick() {
  //             click()
  //             emit('update:modelValue', 'from GrandChild')
  //           },
  //         })
  //     },
  //   })

  //   const root = document.createElement('div')
  //   document.body.appendChild(root)
  //   render(h(App), root)

  //   const node = root.children[0] as HTMLElement

  //   node.dispatchEvent(new CustomEvent('click'))
  //   expect(click).toHaveBeenCalled()
  //   expect(textBar).toBe('from GrandChild')
  //   expect(textFoo).toBe('from Child')
  // })

  // // covers uncaught regression #10710
  // it('should track this.$attrs access in slots', async () => {
  //   const GrandChild = {
  //     template: `<slot/>`,
  //   }
  //   const Child = {
  //     components: { GrandChild },
  //     template: `<div><GrandChild>{{ $attrs.foo }}</GrandChild></div>`,
  //   }

  //   const obj = ref(1)
  //   const App = {
  //     render() {
  //       return h(Child, { foo: obj.value })
  //     },
  //   }

  //   const root = document.createElement('div')
  //   createApp(App).mount(root)

  //   expect(root.innerHTML).toBe('<div foo="1">1</div>')

  //   obj.value = 2
  //   await nextTick()
  //   expect(root.innerHTML).toBe('<div foo="2">2</div>')
  // })

  it('should allow attrs to fallthrough on component with comment at root', async () => {
    const t0 = template('<!--comment-->')
    const t1 = template('<div>')
    const { component: Child } = define({
      props: ['foo'],
      setup(props: any) {
        const n0 = t0()
        const n1 = t1()
        renderEffect(() => setElementText(n1, props.foo))
        return [n0, n1]
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { host } = define({
      setup() {
        return createComponent(
          Child,
          {
            foo: () => foo.value,
            id: () => id.value,
          },
          null,
          true,
        )
      },
    }).render()
    expect(host.innerHTML).toBe('<!--comment--><div id="a">1</div>')

    foo.value++
    await nextTick()
    expect(host.innerHTML).toBe('<!--comment--><div id="a">2</div>')

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<!--comment--><div id="b">2</div>')
  })

  it('if block', async () => {
    const t0 = template('<div>foo</div>', true)
    const t1 = template('<div>bar</div>', true)
    const t2 = template('<div>baz</div>', true)
    const { component: Child } = define({
      setup() {
        const n0 = createIf(
          () => true,
          () => {
            const n2 = t0()
            return n2
          },
          () =>
            createIf(
              () => false,
              () => {
                const n4 = t1()
                return n4
              },
              () => {
                const n7 = t2()
                return n7
              },
            ),
        )
        return n0
      },
    })

    const id = ref('a')
    const { host } = define({
      setup() {
        return createComponent(
          Child,
          {
            id: () => id.value,
          },
          null,
          true,
        )
      },
    }).render()
    expect(host.innerHTML).toBe('<div id="a">foo</div><!--if-->')
  })

  it('should not allow attrs to fallthrough on component with multiple roots', async () => {
    const t0 = template('<span>')
    const t1 = template('<div>')
    const { component: Child } = define({
      props: ['foo'],
      setup(props: any) {
        const n0 = t0()
        const n1 = t1()
        renderEffect(() => setElementText(n1, props.foo))
        return [n0, n1]
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { host } = define({
      setup() {
        return createComponent(
          Child,
          {
            foo: () => foo.value,
            id: () => id.value,
          },
          null,
          true,
        )
      },
    }).render()
    expect(host.innerHTML).toBe('<span></span><div>1</div>')
    expect(`Extraneous non-props attributes (id)`).toHaveBeenWarned()
  })

  it('should not allow attrs to fallthrough on component with single comment root', async () => {
    const t0 = template('<!--comment-->')
    const { component: Child } = define({
      setup() {
        const n0 = t0()
        return [n0]
      },
    })

    const id = ref('a')
    const { host } = define({
      setup() {
        return createComponent(Child, { id: () => id.value }, null, true)
      },
    }).render()
    expect(host.innerHTML).toBe('<!--comment-->')
    expect(`Extraneous non-props attributes (id)`).toHaveBeenWarned()
  })

  it('should not fallthrough if explicitly pass inheritAttrs: false', async () => {
    const t0 = template('<div>', true)
    const { component: Child } = define({
      props: ['foo'],
      inheritAttrs: false,
      setup(props: any) {
        const n0 = t0() as Element
        renderEffect(() => setElementText(n0, props.foo))
        return n0
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { host } = define({
      setup() {
        return createComponent(
          Child,
          {
            foo: () => foo.value,
            id: () => id.value,
          },
          null,
          true,
        )
      },
    }).render()
    expect(host.innerHTML).toBe('<div>1</div>')

    foo.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div>2</div>')

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div>2</div>')
  })

  it('should pass through attrs in nested single root components', async () => {
    const t0 = template('<div>', true)
    const { component: Grandson } = define({
      props: ['custom-attr'],
      setup(_: any, { attrs }: any) {
        const n0 = t0() as Element
        renderEffect(() => setElementText(n0, attrs.foo))
        return n0
      },
    })

    const { component: Child } = define({
      setup() {
        const n0 = createComponent(
          Grandson,
          {
            'custom-attr': () => 'custom-attr',
          },
          null,
          true,
        )
        return n0
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { host } = define({
      setup() {
        return createComponent(
          Child,
          {
            foo: () => foo.value,
            id: () => id.value,
          },
          null,
          true,
        )
      },
    }).render()
    expect(host.innerHTML).toBe('<div foo="1" id="a">1</div>')

    foo.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div foo="2" id="a">2</div>')

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div foo="2" id="b">2</div>')
  })

  it('should merge classes', async () => {
    const rootClass = ref('root')
    const parentClass = ref('parent')
    const childClass = ref('child')

    const t0 = template('<div>', true /* root */)
    const Child = defineVaporComponent({
      setup() {
        const n = t0() as Element
        renderEffect(() => {
          // binding on template root generates incremental class setter
          setClass(n, childClass.value)
        })
        return n
      },
    })

    const Parent = defineVaporComponent({
      setup() {
        return createComponent(
          Child,
          {
            class: () => parentClass.value,
          },
          null,
          true, // pass single root flag
        )
      },
    })

    const { host } = define({
      setup() {
        return createComponent(Parent, {
          class: () => rootClass.value,
        })
      },
    }).render()

    const list = host.children[0].classList
    // assert classes without being order-sensitive
    function assertClasses(cls: string[]) {
      expect(list.length).toBe(cls.length)
      for (const c of cls) {
        expect(list.contains(c)).toBe(true)
      }
    }

    assertClasses(['root', 'parent', 'child'])

    rootClass.value = 'root1'
    await nextTick()
    assertClasses(['root1', 'parent', 'child'])

    parentClass.value = 'parent1'
    await nextTick()
    assertClasses(['root1', 'parent1', 'child'])

    childClass.value = 'child1'
    await nextTick()
    assertClasses(['root1', 'parent1', 'child1'])
  })

  it('should merge styles', async () => {
    const rootStyle: Ref<string | Record<string, string>> = ref('color:red')
    const parentStyle: Ref<string | null> = ref('font-size:12px')
    const childStyle = ref('font-weight:bold')

    const t0 = template('<div>', true /* root */)
    const Child = defineVaporComponent({
      setup() {
        const n = t0() as Element
        renderEffect(() => {
          // binding on template root generates incremental class setter
          setStyle(n, childStyle.value)
        })
        return n
      },
    })

    const Parent = defineVaporComponent({
      setup() {
        return createComponent(
          Child,
          {
            style: () => parentStyle.value,
          },
          null,
          true, // pass single root flag
        )
      },
    })

    const { host } = define({
      setup() {
        return createComponent(Parent, {
          style: () => rootStyle.value,
        })
      },
    }).render()

    const el = host.children[0] as HTMLElement

    function getCSS() {
      return el.style.cssText.replace(/\s+/g, '')
    }

    function assertStyles() {
      const css = getCSS()
      expect(css).toContain(stringifyStyle(rootStyle.value))
      if (parentStyle.value) {
        expect(css).toContain(stringifyStyle(parentStyle.value))
      }
      expect(css).toContain(stringifyStyle(childStyle.value))
    }

    assertStyles()

    rootStyle.value = { color: 'green' }
    await nextTick()
    assertStyles()
    expect(getCSS()).not.toContain('color:red')

    parentStyle.value = null
    await nextTick()
    assertStyles()
    expect(getCSS()).not.toContain('font-size:12px')

    childStyle.value = 'font-weight:500'
    await nextTick()
    assertStyles()
    expect(getCSS()).not.toContain('font-size:bold')
  })

  it('should fallthrough attrs to dynamic component', async () => {
    const Comp = defineVaporComponent({
      setup() {
        const n1 = createDynamicComponent(
          () => 'button',
          null,
          {
            default: withVaporCtx(() => {
              const n0 = createSlot('default', null)
              return n0
            }),
          },
          true,
        )
        return n1
      },
    })

    const { html } = define({
      setup() {
        return createComponent(
          Comp,
          {
            class: () => 'foo',
          },
          null,
          true,
        )
      },
    }).render()

    expect(html()).toBe(
      '<button class="foo"><!--slot--></button><!--dynamic-component-->',
    )
  })

  it('parent value should take priority', async () => {
    const parentVal = ref('parent')
    const childVal = ref('child')

    const t0 = template('<div>', true /* root */)
    const Child = defineVaporComponent({
      setup() {
        const n = t0()
        renderEffect(() => {
          // prop bindings on template root generates extra `root: true` flag
          setProp(n, 'id', childVal.value)
          setProp(n, 'aria-x', childVal.value)
          setDynamicProps(n, [{ 'aria-y': childVal.value }])
        })
        return n
      },
    })

    const { host } = define({
      setup() {
        return createComponent(Child, {
          id: () => parentVal.value,
          'aria-x': () => parentVal.value,
          'aria-y': () => parentVal.value,
        })
      },
    }).render()

    const el = host.children[0]
    expect(el.id).toBe(parentVal.value)
    expect(el.getAttribute('aria-x')).toBe(parentVal.value)
    expect(el.getAttribute('aria-y')).toBe(parentVal.value)

    childVal.value = 'child1'
    await nextTick()
    expect(el.id).toBe(parentVal.value)
    expect(el.getAttribute('aria-x')).toBe(parentVal.value)
    expect(el.getAttribute('aria-y')).toBe(parentVal.value)

    parentVal.value = 'parent1'
    await nextTick()
    expect(el.id).toBe(parentVal.value)
    expect(el.getAttribute('aria-x')).toBe(parentVal.value)
    expect(el.getAttribute('aria-y')).toBe(parentVal.value)
  })

  it('empty string should not be passed to classList.add', async () => {
    const t0 = template('<div>', true /* root */)
    const Child = defineVaporComponent({
      setup() {
        const n = t0() as Element
        renderEffect(() => {
          setClass(n, {
            foo: false,
          })
        })
        return n
      },
    })

    const Parent = defineVaporComponent({
      setup() {
        return createComponent(
          Child,
          {
            class: () => ({
              bar: false,
            }),
          },
          null,
          true,
        )
      },
    })

    const { host } = define({
      setup() {
        return createComponent(Parent)
      },
    }).render()

    const el = host.children[0]
    expect(el.classList.length).toBe(0)
  })
})
