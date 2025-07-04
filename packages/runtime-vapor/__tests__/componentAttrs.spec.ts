import { type Ref, nextTick, ref } from '@vue/runtime-dom'
import {
  createComponent,
  createDynamicComponent,
  createSlot,
  defineVaporComponent,
  renderEffect,
  setClass,
  setDynamicProps,
  setProp,
  setStyle,
  template,
} from '../src'
import { makeRender } from './_utils'
import { stringifyStyle } from '@vue/shared'
import { setElementText } from '../src/dom/prop'

const define = makeRender<any>()

// TODO: port more tests from rendererAttrsFallthrough.spec.ts

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
            default: () => {
              const n0 = createSlot('default', null)
              return n0
            },
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
