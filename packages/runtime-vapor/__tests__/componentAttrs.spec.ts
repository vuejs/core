import {
  type Ref,
  nextTick,
  onUpdated,
  ref,
  withModifiers,
} from '@vue/runtime-dom'
import {
  VaporKeepAlive,
  VaporTeleport,
  createComponent,
  createDynamicComponent,
  createIf,
  createKeyedFragment,
  createSlot,
  defineVaporComponent,
  delegateEvents,
  renderEffect,
  setClass,
  setDynamicProps,
  setInsertionState,
  setProp,
  setStyle,
  template,
} from '../src'
import { compile, makeRender } from './_utils'
import {
  VaporBlockShape,
  VaporDynamicComponentFlags,
  VaporIfFlags,
  stringifyStyle,
} from '@vue/shared'
import { setElementText } from '../src/dom/prop'

const define = makeRender<any>()
delegateEvents('click')

describe('attribute fallthrough', () => {
  it('should allow attrs to fallthrough', async () => {
    const t0 = template('<div>', 1)
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
        1,
      )() as Element
      renderEffect(() => setElementText(n0, props.foo))
      return n0
    })

    const { host } = define(Hello).render()
    expect(host.innerHTML).toBe(
      '<div class="c2 c0" style="font-weight: bold; color: green;">1</div>',
    )

    const node = host.children[0] as HTMLElement

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

  it('should preserve root bindings excluded from functional fallthrough', async () => {
    const title = ref('one')
    const { component: Child } = define((props: any) => {
      const n0 = template('<div></div>', 1)() as Element
      renderEffect(() => setProp(n0, 'title', `child:${props.title}`))
      return n0
    })

    const { host } = define({
      setup() {
        return createComponent(Child, {
          title: () => title.value,
        })
      },
    }).render()

    expect(host.innerHTML).toBe('<div title="child:one"></div>')

    title.value = 'two'
    await nextTick()
    expect(host.innerHTML).toBe('<div title="child:two"></div>')
  })

  it('should only allow whitelisted fallthrough on functional component dynamic root branch', async () => {
    const show = ref(false)
    const parentClass = ref('c0')

    const t0 = template('<div class="c2">off</div>', 1)
    const t1 = template('<div class="c2">on</div>', 1)
    const { component: Child } = define(() => {
      return createIf(
        () => show.value,
        () => t1(),
        () => t0(),
      )
    })

    const { host } = define(() =>
      createComponent(Child, {
        foo: () => 'bar',
        id: () => 'test',
        class: () => parentClass.value,
      }),
    ).render()

    const assertRoot = (text: string) => {
      const node = host.children[0] as HTMLElement
      expect(node.textContent).toBe(text)
      expect(node.getAttribute('id')).toBe(null)
      expect(node.getAttribute('foo')).toBe(null)
      expect(node.classList.contains('c2')).toBe(true)
      expect(node.classList.contains(parentClass.value)).toBe(true)
    }

    assertRoot('off')

    show.value = true
    await nextTick()
    assertRoot('on')

    parentClass.value = 'c1'
    await nextTick()
    assertRoot('on')
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
        1,
      )() as Element
      renderEffect(() => setElementText(n0, props.foo))
      return n0
    })

    // @ts-expect-error
    Child.props = ['foo']

    const { host } = define(Hello).render()
    const node = host.children[0] as HTMLElement

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
          1,
        )() as Element
        renderEffect(() => {
          setProp(n0, 'id', props.id)
          setElementText(n0, props.foo)
        })
        return n0
      },
    })

    const { host } = define(Hello).render()
    expect(host.innerHTML).toBe(
      '<div class="c2 c0" style="font-weight: bold; color: green;" id="test">1</div>',
    )

    const node = host.children[0] as HTMLElement

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
        const n0 = template('<div></div>', 1)() as Element
        renderEffect(() => setElementText(n0, props.foo))
        return n0
      },
    })

    const { html } = define(Parent).render()

    // should not contain class
    expect(html()).toMatch(`<div>1</div>`)
  })

  it('explicit spreading with inheritAttrs: false', () => {
    const click = vi.fn()
    const Parent = defineVaporComponent({
      setup() {
        return createComponent(Child, {
          foo: () => 1,
          class: () => 'parent',
          onClick: () => click,
        })
      },
    })

    const Child = defineVaporComponent({
      props: ['foo'],
      inheritAttrs: false,
      setup(props, { attrs }) {
        const n0 = template('<div>', 1)() as Element
        renderEffect(() => {
          setElementText(n0, props.foo)
          setDynamicProps(n0, [{ class: 'child' }, attrs])
        })
        return n0
      },
    })

    const { host, html } = define(Parent).render()

    // should merge parent/child classes
    expect(html()).toMatch(`<div class="child parent">1</div>`)
    ;(host.children[0] as HTMLElement).click()
    expect(click).toHaveBeenCalledTimes(1)
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

    const target = document.createElement('div')
    const Child = defineVaporComponent({
      render() {
        return createComponent(
          VaporTeleport,
          { to: () => target },
          {
            default: () => template('<div></div>')(),
          },
        )
      },
    })

    document.body.appendChild(target)
    define(Parent).render()

    expect(`Extraneous non-props attributes (class)`).toHaveBeenWarned()
  })

  it('should warn when fallthrough fails on dynamic teleport root branch', async () => {
    const show = ref(false)
    const target = document.createElement('div')
    document.body.appendChild(target)

    const fallback = template('<div>fallback</div>', 1)
    const teleported = template('<div>teleported</div>')
    const { component: Child } = define(() =>
      createIf(
        () => show.value,
        () =>
          createComponent(
            VaporTeleport,
            { to: () => target },
            {
              default: () => teleported(),
            },
          ),
        () => fallback(),
      ),
    )

    const { host } = define(() =>
      createComponent(Child, { class: () => 'parent' }),
    ).render()

    expect((host.children[0] as HTMLElement).className).toBe('parent')

    show.value = true
    await nextTick()

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
        const n0 = template('<div></div>', 1)() as any
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

  it('should not warn when only emits is defined', () => {
    const Parent = {
      render() {
        return createComponent(Child, {
          onBar: () => () => {},
        })
      },
    }

    const Child = defineVaporComponent({
      emits: ['bar'],
      render() {
        const n0 = template('<div></div>')() as Element
        const n1 = template('<div></div>')() as Element

        return [n0, n1]
      },
    })

    define(Parent).render()
    expect(`Extraneous non-emits event listeners`).not.toHaveBeenWarned()
  })

  it('should not let listener fallthrough when declared in emits (stateful)', () => {
    const Child = defineVaporComponent({
      emits: ['click'],
      render(_ctx, $props, $emit, $attrs, $slots) {
        const n0 = template('<button>hello</button>')() as any
        n0.$evtclick = () => {
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

    const { host } = define(App).render()
    const node = host.children[0] as HTMLElement
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

    const { host } = define(App).render()
    const node = host.children[0] as HTMLElement
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

    const { host } = define(Hello).render()

    expect(host.innerHTML).toBe(
      `<!--hello--><button class="foo"></button><!--world-->`,
    )
    const button = host.children[0] as HTMLElement
    button.dispatchEvent(new CustomEvent('click'))
    expect(click).toHaveBeenCalled()
  })

  it('should support fallthrough for nested element + comments', async () => {
    const toggle = ref(false)
    const Child = defineVaporComponent({
      setup() {
        const n0 = template('<!-- comment A -->')() as any
        const n1 = createIf(
          () => toggle.value,
          () => template('<span>Foo</span>')(),
          () => {
            const n2 = template('<!-- comment B -->')() as any
            const n3 = template('<div>Bar</div>')() as any
            return [n2, n3]
          },
        )
        return [n0, n1]
      },
    })

    const Root = defineVaporComponent({
      setup() {
        return createComponent(Child, { class: () => 'red' })
      },
    })

    const { host } = define(Root).render()

    expect(host.innerHTML).toBe(
      `<!-- comment A --><!-- comment B --><div class="red">Bar</div><!--if-->`,
    )

    toggle.value = true
    await nextTick()
    expect(host.innerHTML).toBe(
      `<!-- comment A --><span class="red">Foo</span><!--if-->`,
    )
  })

  it('should not fallthrough v-model listeners with corresponding declared prop', () => {
    let textFoo = ''
    let textBar = ''
    const click = vi.fn()

    const App = defineVaporComponent({
      render() {
        return createComponent(Child, {
          modelValue: () => textFoo,
          'onUpdate:modelValue': () => (val: string) => {
            textFoo = val
          },
        })
      },
    })

    const Child = defineVaporComponent({
      props: ['modelValue'],
      setup(_props, { emit }) {
        return createComponent(GrandChild, {
          modelValue: () => textBar,
          'onUpdate:modelValue': () => (val: string) => {
            textBar = val
            emit('update:modelValue', 'from Child')
          },
        })
      },
    })

    const GrandChild = defineVaporComponent({
      props: ['modelValue'],
      setup(_props, { emit }) {
        const n0 = template('<button></button>')() as any
        n0.$evtclick = () => {
          click()
          emit('update:modelValue', 'from GrandChild')
        }
        return n0
      },
    })

    const { host } = define(App).render()
    const node = host.children[0] as HTMLElement
    node.click()
    expect(click).toHaveBeenCalled()
    expect(textBar).toBe('from GrandChild')
    expect(textFoo).toBe('from Child')
  })

  it('should track this.$attrs access in slots', async () => {
    const GrandChild = defineVaporComponent({
      render() {
        return createSlot('default')
      },
    })
    const Child = defineVaporComponent({
      components: { GrandChild },
      render(_ctx, $props, $emit, $attrs, $slots) {
        const n0 = template('<div></div>')() as any
        setInsertionState(n0)
        createComponent(GrandChild, null, {
          default: () => {
            const n1 = template(' ')()
            renderEffect(() => setElementText(n1, $attrs.foo))
            return n1
          },
        })
        return n0
      },
    })

    const obj = ref(1)
    const App = defineVaporComponent({
      render() {
        return createComponent(Child, { foo: () => obj.value })
      },
    })

    const { html } = define(App).render()
    expect(html()).toBe('<div foo="1">1<!--slot--></div>')

    obj.value = 2
    await nextTick()
    expect(html()).toBe('<div foo="2">2<!--slot--></div>')
  })

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
    const t0 = template('<div>foo</div>', 1)
    const t1 = template('<div>bar</div>', 1)
    const t2 = template('<div>baz</div>', 1)
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

  it('should fallthrough attrs on v-else-if component root branch', async () => {
    const data = ref({
      loading: false,
      id: 'foo',
    })
    const Child = compile(
      `<script setup vapor>
        defineProps({
          loading: {
            type: Boolean,
            default: false
          }
        })
      </script>
      <template>
        <div v-if="loading" class="simple-button">
          loading === true
        </div>
        <div v-else-if="loading === false" class="simple-button">
          loading === false
        </div>
      </template>`,
      data,
    )
    const Parent = compile(
      `<script setup vapor>
        const data = _data
        const Child = _components.Child
      </script>
      <template>
        <Child :loading="data.loading" :id="data.id" class="custom-btn" />
      </template>`,
      data,
      { Child },
    )

    const { host } = define(Parent).render()

    const root = () => host.querySelector('.simple-button') as HTMLElement
    const assertRoot = (text: string) => {
      const el = root()
      expect(el.classList.contains('simple-button')).toBe(true)
      expect(el.classList.contains('custom-btn')).toBe(true)
      expect(el.id).toBe(data.value.id)
      expect(el.textContent!.trim()).toBe(text)
    }

    assertRoot('loading === false')

    data.value.id = 'bar'
    await nextTick()
    assertRoot('loading === false')

    data.value.loading = true
    await nextTick()
    assertRoot('loading === true')

    data.value.loading = false
    await nextTick()
    assertRoot('loading === false')
  })

  it('should not fallthrough attrs into nested slot branch', async () => {
    const show = ref(false)
    const Child = compile(
      `<script setup vapor>
        defineProps({
          show: Boolean
        })
      </script>
      <template>
        <div v-if="!show">fallback</div>
        <slot v-else-if="show" />
      </template>`,
      show,
    )
    const Parent = compile(
      `<script setup vapor>
        const show = _data
        const Child = _components.Child
      </script>
      <template>
        <Child :show="show" class="custom-btn">
          <span>slot</span>
        </Child>
      </template>`,
      show,
      { Child },
    )

    const { host } = define(Parent).render()

    expect((host.querySelector('div') as HTMLElement).className).toBe(
      'custom-btn',
    )

    show.value = true
    await nextTick()
    const span = host.querySelector('span') as HTMLElement
    expect(span.className).toBe('')
    expect(`Extraneous non-props attributes (class)`).toHaveBeenWarned()
  })

  it('should not fallthrough attrs into initially active nested slot branch', async () => {
    const show = ref(true)
    const Child = compile(
      `<script setup vapor>
        defineProps({
          show: Boolean
        })
      </script>
      <template>
        <div v-if="!show">fallback</div>
        <slot v-else-if="show" />
      </template>`,
      show,
    )
    const Parent = compile(
      `<script setup vapor>
        const show = _data
        const Child = _components.Child
      </script>
      <template>
        <Child :show="show" class="custom-btn">
          <span>slot</span>
        </Child>
      </template>`,
      show,
      { Child },
    )

    const { host } = define(Parent).render()
    const span = host.querySelector('span') as HTMLElement

    expect(span.className).toBe('')
    expect(`Extraneous non-props attributes (class)`).toHaveBeenWarned()
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

  it('should not apply attrs to dynamic branch inside multi-root component', async () => {
    const ok = ref(false)

    const t0 = template('<div>one</div>', 1)
    const t1 = template('<span>two</span>')

    const { component: Child } = define({
      setup() {
        return [
          createIf(
            () => ok.value,
            () => t0(),
          ),
          t1(),
        ]
      },
    })

    const { host } = define(() =>
      createComponent(Child, { class: () => 'x' }),
    ).render()

    expect(`Extraneous non-props attributes (class)`).toHaveBeenWarned()

    ok.value = true
    await nextTick()

    expect((host.querySelector('div') as HTMLElement).className).toBe('')
  })

  it('should warn for initially active multi-root dynamic root branch', async () => {
    const ok = ref(true)

    const t0 = template('<div>one</div>')
    const t1 = template('<span>two</span>')
    const t2 = template('<p>three</p>', 1)

    const { component: Child } = define({
      setup() {
        return createIf(
          () => ok.value,
          () => [t0(), t1()],
          () => t2(),
        )
      },
    })

    const { host } = define(() =>
      createComponent(Child, { class: () => 'x' }),
    ).render()

    expect((host.querySelector('div') as HTMLElement).className).toBe('')
    expect((host.querySelector('span') as HTMLElement).className).toBe('')
    expect(`Extraneous non-props attributes (class)`).toHaveBeenWarned()

    ok.value = false
    await nextTick()

    expect((host.querySelector('p') as HTMLElement).className).toBe('x')
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
    const t0 = template('<div>', 1)
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
    const t0 = template('<div>', 1)
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

    const t0 = template('<div>', 1 /* root */)
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

    const t0 = template('<div>', 1 /* root */)
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
            default: () => {
              const n0 = createSlot('default', null)
              return n0
            },
          },
          VaporDynamicComponentFlags.SINGLE_ROOT,
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

    const t0 = template('<div>', 1 /* root */)
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
    const t0 = template('<div>', 1 /* root */)
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

  it('passes v-text to components as a reactive textContent prop', async () => {
    const value = ref('<b>one</b>')
    const Child = compile(
      `<script setup vapor>
        const props = defineProps(['textContent'])
      </script>
      <template><div>prop:{{ props.textContent }}</div></template>`,
      ref(null),
    )
    const Parent = compile(
      `<template><components.Child v-text="data" /></template>`,
      value,
      { Child },
    )

    const { host } = define(Parent).render()
    expect(host.innerHTML).toBe('<div>prop:&lt;b&gt;one&lt;/b&gt;</div>')

    value.value = '<i>two</i>'
    await nextTick()
    expect(host.innerHTML).toBe('<div>prop:&lt;i&gt;two&lt;/i&gt;</div>')
  })

  it('passes v-html to components as a reactive innerHTML prop', async () => {
    const value = ref('<b>one</b>')
    const Child = compile(
      `<script setup vapor>
        const props = defineProps(['innerHTML'])
      </script>
      <template><div>prop:{{ props.innerHTML }}</div></template>`,
      ref(null),
    )
    const Parent = compile(
      `<template><components.Child v-html="data" /></template>`,
      value,
      { Child },
    )

    const { host } = define(Parent).render()
    expect(host.innerHTML).toBe('<div>prop:&lt;b&gt;one&lt;/b&gt;</div>')

    value.value = '<i>two</i>'
    await nextTick()
    expect(host.innerHTML).toBe('<div>prop:&lt;i&gt;two&lt;/i&gt;</div>')
  })

  it('warns when v-text cannot fall through to a text root', () => {
    const Child = compile(`<template>child</template>`, ref(null))
    const Parent = compile(
      `<template><components.Child v-text="data" /></template>`,
      ref('foo'),
      { Child },
    )

    const { host } = define(Parent).render()
    expect(host.textContent).toBe('child')
    expect(`Extraneous non-props attributes (textContent)`).toHaveBeenWarned()
  })

  it('warns when v-html cannot fall through to a text root', () => {
    const Child = compile(`<template>child</template>`, ref(null))
    const Parent = compile(
      `<template><components.Child v-html="data" /></template>`,
      ref('<b>foo</b>'),
      { Child },
    )

    const { host } = define(Parent).render()
    expect(host.textContent).toBe('child')
    expect(`Extraneous non-props attributes (innerHTML)`).toHaveBeenWarned()
  })

  it('does not warn for filtered functional fallthrough on a text root', () => {
    const { component: Child } = define(() => template('child')())
    Child.props = ['foo']
    const Parent = compile(
      `<template><components.Child v-text="data" /></template>`,
      ref('foo'),
      { Child },
    )

    const { host } = define(Parent).render()
    expect(host.textContent).toBe('child')
    expect(`Extraneous non-props attributes`).not.toHaveBeenWarned()
  })

  it('applies v-text fallthrough after switching dynamic components', async () => {
    const state = ref({ current: 'A', content: '<b>one</b>' })
    const A = compile(`<template><div>A</div></template>`, ref(null))
    const B = compile(`<template><div>B</div></template>`, ref(null))
    const Parent = compile(
      `<template>
        <component
          :is="components[data.current]"
          v-text="data.content"
        />
      </template>`,
      state,
      { A, B },
    )

    const { host } = define(Parent).render()
    expect(host.innerHTML).toBe(
      '<div>&lt;b&gt;one&lt;/b&gt;</div><!--dynamic-component-->',
    )

    state.value = { ...state.value, current: 'B' }
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div>&lt;b&gt;one&lt;/b&gt;</div><!--dynamic-component-->',
    )

    state.value = { ...state.value, content: '<i>two</i>' }
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div>&lt;i&gt;two&lt;/i&gt;</div><!--dynamic-component-->',
    )
  })

  it('applies v-html fallthrough after switching dynamic components', async () => {
    const state = ref({ current: 'A', content: '<b>one</b>' })
    const A = compile(`<template><div>A</div></template>`, ref(null))
    const B = compile(`<template><div>B</div></template>`, ref(null))
    const Parent = compile(
      `<template>
        <component
          :is="components[data.current]"
          v-html="data.content"
        />
      </template>`,
      state,
      { A, B },
    )

    const { host } = define(Parent).render()
    expect(host.innerHTML).toBe('<div><b>one</b></div><!--dynamic-component-->')

    state.value = { ...state.value, current: 'B' }
    await nextTick()
    expect(host.innerHTML).toBe('<div><b>one</b></div><!--dynamic-component-->')

    state.value = { ...state.value, content: '<i>two</i>' }
    await nextTick()
    expect(host.innerHTML).toBe('<div><i>two</i></div><!--dynamic-component-->')
  })

  // #15277
  it('should pass fallthrough attrs to declared props with inheritAttrs: false', () => {
    const Child = compile(
      `<script setup vapor>
        const { class: className } = defineProps({ class: String })
        defineOptions({ inheritAttrs: false })
      </script>
      <template>
        <div :class="className">class prop = {{ className ?? 'DROPPED' }}</div>
      </template>`,
      ref(null),
    )
    const Middle = compile(
      `<template><components.Child /></template>`,
      ref(null),
      { Child },
    )
    const App = compile(
      `<template><components.Middle class="forwarded-marker" /></template>`,
      ref(null),
      { Middle },
    )

    const { host } = define(App).render()
    expect(host.innerHTML).toBe(
      '<div class="forwarded-marker">class prop = forwarded-marker</div>',
    )
  })

  it('should not pass attrs through a component with inheritAttrs: false', () => {
    const Child = compile(
      `<script setup vapor>
        const { class: className } = defineProps({ class: String })
      </script>
      <template>
        <div :class="className">class prop = {{ className ?? 'DROPPED' }}</div>
      </template>`,
      ref(null),
    )
    const Middle = compile(
      `<script setup vapor>
        const Child = _components.Child
        defineOptions({ inheritAttrs: false })
      </script>
      <template><Child /></template>`,
      ref(null),
      { Child },
    )
    const App = compile(
      `<template><components.Middle class="forwarded-marker" /></template>`,
      ref(null),
      { Middle },
    )

    const { host } = define(App).render()
    expect(host.innerHTML).toBe('<div>class prop = DROPPED</div>')
  })

  it('should apply dynamic attrs that appear after mount', async () => {
    const t0 = template('<div>', 1)
    const { component: Child } = define({
      setup() {
        return t0()
      },
    })

    const attrs = ref<Record<string, any>>({})
    const { host } = define({
      setup() {
        return createComponent(Child, { $: [() => attrs.value] }, null, true)
      },
    }).render()
    expect(host.innerHTML).toBe('<div></div>')

    attrs.value = { id: 'late' }
    await nextTick()
    expect(host.innerHTML).toBe('<div id="late"></div>')

    attrs.value = {}
    await nextTick()
    expect(host.innerHTML).toBe('<div></div>')
  })

  it('should clean up functional fallthrough when allowed keys are removed', async () => {
    const attrs = ref<Record<string, any>>({ class: 'foo' })
    const Fn = () => template('<div>', 1)()
    const { host } = define({
      setup() {
        return createComponent(
          Fn as any,
          { $: [() => attrs.value] },
          null,
          true,
        )
      },
    }).render()
    const node = host.children[0] as HTMLElement
    expect(node.className).toBe('foo')

    // class removed; id is not a functional fallthrough key, so the
    // resolved fallthrough set becomes empty and must still diff away
    // the previously applied class
    attrs.value = { id: 'x' }
    await nextTick()
    expect(node.className).toBe('')
    expect(node.getAttribute('id')).toBe(null)
  })

  it('should filter functional fallthrough forwarded to a component root', () => {
    const t0 = template('<div>', 1)
    const { component: Inner } = define({
      setup() {
        return t0()
      },
    })
    const Fn = () => createComponent(Inner, null, null, true)
    const { host } = define({
      setup() {
        return createComponent(
          Fn as any,
          { id: () => 'x', class: () => 'c' },
          null,
          true,
        )
      },
    }).render()
    const node = host.children[0] as HTMLElement
    expect(node.getAttribute('class')).toBe('c')
    expect(node.getAttribute('id')).toBe(null)
  })

  it('should not fallthrough v-model listeners with a declared prop', () => {
    const declared = vi.fn()
    const undeclared = vi.fn()
    const t0 = template('<div>', 1)
    const { component: Child } = define({
      props: ['foo'],
      setup() {
        return t0()
      },
    })
    const { host } = define({
      setup() {
        return createComponent(
          Child,
          {
            'onUpdate:foo': () => declared,
            'onUpdate:bar': () => undeclared,
            id: () => 'x',
          },
          null,
          true,
        )
      },
    }).render()
    const node = host.children[0] as HTMLElement
    expect(node.getAttribute('id')).toBe('x')
    node.dispatchEvent(new CustomEvent('update:foo'))
    expect(declared).not.toHaveBeenCalled()
    node.dispatchEvent(new CustomEvent('update:bar'))
    expect(undeclared).toHaveBeenCalled()
  })

  it('should not forward declared v-model listeners into a component root', () => {
    const handler = vi.fn()
    const t0 = template('<div>', 1)
    const { component: Child } = define({
      setup() {
        return t0()
      },
    })
    const { component: Middle } = define({
      props: ['foo'],
      setup() {
        return createComponent(Child, null, null, true)
      },
    })
    const { host } = define({
      setup() {
        return createComponent(
          Middle,
          {
            'onUpdate:foo': () => handler,
            id: () => 'x',
          },
          null,
          true,
        )
      },
    }).render()
    const node = host.children[0] as HTMLElement
    expect(node.getAttribute('id')).toBe('x')
    node.dispatchEvent(new CustomEvent('update:foo'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('should stop updating fallthrough attrs on a root detached by branch switch', async () => {
    const show = ref(true)
    const id = ref('a')
    const t0 = template('<div>foo</div>', 1)
    const { component: Child } = define({
      setup() {
        return createIf(
          () => show.value,
          () => t0(),
        )
      },
    })
    const { host } = define({
      setup() {
        return createComponent(Child, { id: () => id.value }, null, true)
      },
    }).render()

    const initialRoot = host.querySelector('div')!
    expect(initialRoot.getAttribute('id')).toBe('a')

    show.value = false
    await nextTick()
    expect(initialRoot.isConnected).toBe(false)

    id.value = 'b'
    await nextTick()
    // the branch scope owns the effect, so the detached root is not updated
    expect(initialRoot.getAttribute('id')).toBe('a')

    show.value = true
    await nextTick()
    expect(host.innerHTML).toBe('<div id="b">foo</div><!--if-->')
  })

  it('should stop updating fallthrough attrs on a detached nested branch root', async () => {
    const outer = ref(true)
    const inner = ref(true)
    const id = ref('a')
    const t0 = template('<div>outer</div>', 1)
    const t1 = template('<p>inner</p>', 1)
    const t2 = template('<span>inner-else</span>', 1)
    const { component: Child } = define({
      setup() {
        return createIf(
          () => outer.value,
          () => t0(),
          () =>
            createIf(
              () => inner.value,
              () => t1(),
              () => t2(),
            ),
        )
      },
    })
    const { host } = define({
      setup() {
        return createComponent(Child, { id: () => id.value }, null, true)
      },
    }).render()

    outer.value = false
    await nextTick()
    const innerEl = host.querySelector('p')!
    expect(innerEl.getAttribute('id')).toBe('a')

    // switching only the inner branch stops the inner branch scope, which
    // owns the effect for the inner root
    inner.value = false
    await nextTick()
    expect(innerEl.isConnected).toBe(false)

    id.value = 'b'
    await nextTick()
    expect(innerEl.getAttribute('id')).toBe('a')
    expect(host.querySelector('span')!.getAttribute('id')).toBe('b')
  })

  it('should scope fallthrough for no-scope nested branch roots', async () => {
    const outer = ref(true)
    const inner = ref(true)
    const id = ref('a')
    const t0 = template('<div>outer</div>', 1)
    const t1 = template('<p>inner</p>', 1)
    const t2 = template('<span>inner-else</span>', 1)
    const noScopeIfElse =
      VaporBlockShape.SINGLE_ROOT |
      (VaporBlockShape.SINGLE_ROOT << 2) |
      VaporIfFlags.TRUE_NO_SCOPE |
      VaporIfFlags.FALSE_NO_SCOPE
    const { component: Child } = define({
      setup() {
        return createIf(
          () => outer.value,
          () => t0(),
          () =>
            createIf(
              () => inner.value,
              () => t1(),
              () => t2(),
              noScopeIfElse,
            ),
        )
      },
    })
    const { host } = define({
      setup() {
        return createComponent(Child, { id: () => id.value }, null, true)
      },
    }).render()

    outer.value = false
    await nextTick()
    const innerEl = host.querySelector('p')!
    expect(innerEl.getAttribute('id')).toBe('a')

    // the no-scope inner branch received a retrofitted scope owning the
    // effect; switching it stops that scope
    inner.value = false
    await nextTick()
    expect(innerEl.isConnected).toBe(false)
    id.value = 'b'
    await nextTick()
    expect(innerEl.getAttribute('id')).toBe('a')
    const spanEl = host.querySelector('span')!
    expect(spanEl.getAttribute('id')).toBe('b')

    // switching the outer branch tears the nested chain down with it
    outer.value = true
    await nextTick()
    expect(spanEl.isConnected).toBe(false)
    id.value = 'c'
    await nextTick()
    expect(spanEl.getAttribute('id')).toBe('b')
    expect(host.querySelector('div')!.getAttribute('id')).toBe('c')
  })

  it('should reapply fallthrough attrs across keyed root re-renders', async () => {
    const key = ref(0)
    const id = ref('a')
    const t0 = template('<div>keyed</div>', 1)
    const { component: Child } = define({
      setup() {
        return createKeyedFragment(
          () => key.value,
          () => t0(),
        )
      },
    })
    const { host } = define({
      setup() {
        return createComponent(Child, { id: () => id.value }, null, true)
      },
    }).render()
    const first = host.querySelector('div')!
    expect(first.getAttribute('id')).toBe('a')

    key.value++
    await nextTick()
    const second = host.querySelector('div')!
    expect(second).not.toBe(first)
    expect(second.getAttribute('id')).toBe('a')

    id.value = 'b'
    await nextTick()
    expect(second.getAttribute('id')).toBe('b')
    // the replaced root's effect died with its branch scope
    expect(first.getAttribute('id')).toBe('a')
  })

  it('should freeze fallthrough on KeepAlive-cached components and catch up on reactivation', async () => {
    const current = ref('one')
    const id = ref('a')
    const One = defineVaporComponent({
      name: 'One',
      setup() {
        return template('<div>one</div>', 1)()
      },
    })
    const Two = defineVaporComponent({
      name: 'Two',
      setup() {
        return template('<span>two</span>', 1)()
      },
    })
    const views: Record<string, any> = { one: One, two: Two }
    const { host } = define({
      setup() {
        return createComponent(VaporKeepAlive as any, null, {
          default: () =>
            createDynamicComponent(() => views[current.value], {
              id: () => id.value,
            }),
        })
      },
    }).render()

    const oneEl = host.querySelector('div')!
    expect(oneEl.getAttribute('id')).toBe('a')

    current.value = 'two'
    await nextTick()
    expect(oneEl.isConnected).toBe(false)

    id.value = 'b'
    await nextTick()
    // cached: committed inputs are frozen, the cached root must not update
    expect(oneEl.getAttribute('id')).toBe('a')
    expect(host.querySelector('span')!.getAttribute('id')).toBe('b')

    current.value = 'one'
    await nextTick()
    // reactivated: committed inputs resume and the effect catches up
    expect(oneEl.isConnected).toBe(true)
    expect(oneEl.getAttribute('id')).toBe('b')
  })
})
