import { createApp, defineComponent, h, nextTick, ref } from '@vue/runtime-dom'
import {
  createComponent,
  createIf,
  createSlot,
  defineVaporComponent,
  insert,
  template,
  vaporInteropPlugin,
} from '../src'

const svgNS = 'http://www.w3.org/2000/svg'
const mathmlNS = 'http://www.w3.org/1998/Math/MathML'
const htmlNS = 'http://www.w3.org/1999/xhtml'

let host: HTMLElement
beforeEach(() => {
  host = document.createElement('div')
})
afterEach(() => {
  host.remove()
})

function mount(comp: any) {
  const app = createApp(comp)
  app.use(vaporInteropPlugin)
  app.mount(host)
  return app
}

// A vapor parent whose template is `html`, with `mountChild()` inserted into
// the node returned by `pick` (the template root by default).
function vaporHost(
  html: string,
  ns: number,
  mountChild: () => any,
  pick: (root: any) => any = root => root,
) {
  return defineVaporComponent({
    setup() {
      const root = template(html, 1, ns)() as any
      insert(mountChild(), pick(root))
      return root
    },
  })
}

describe('vdom-in-vapor element namespace', () => {
  test('vdom component under a vapor <svg>', () => {
    const Circle = defineComponent({ setup: () => () => h('circle') })
    mount(vaporHost('<svg></svg>', 1, () => createComponent(Circle as any)))
    expect(host.querySelector('circle')!.namespaceURI).toBe(svgNS)
  })

  test('nested vdom tree under a vapor <svg> inherits down', () => {
    const Inner = defineComponent({ setup: () => () => h('circle') })
    const Outer = defineComponent({ setup: () => () => h('g', [h(Inner)]) })
    mount(vaporHost('<svg></svg>', 1, () => createComponent(Outer as any)))
    // vdom propagates the namespace through its own subtree, so the interop
    // boundary only has to get the entry point right.
    expect(host.querySelector('g')!.namespaceURI).toBe(svgNS)
    expect(host.querySelector('circle')!.namespaceURI).toBe(svgNS)
  })

  test('vdom component under a vapor <math>', () => {
    const Mi = defineComponent({ setup: () => () => h('mi', 'x') })
    mount(vaporHost('<math></math>', 2, () => createComponent(Mi as any)))
    expect(host.querySelector('mi')!.namespaceURI).toBe(mathmlNS)
  })

  test('vdom content mounted into a vapor <svg> after a v-if flips', async () => {
    const show = ref(false)
    const Rect = defineComponent({ setup: () => () => h('rect') })
    mount(
      defineVaporComponent({
        setup() {
          const root = template('<svg><!></svg>', 1)() as any
          insert(
            createIf(
              () => show.value,
              () => createComponent(Rect as any),
            ) as any,
            root,
            root.firstChild,
          )
          return root
        },
      }),
    )
    show.value = true
    await nextTick()
    expect(host.querySelector('rect')!.namespaceURI).toBe(svgNS)
  })

  test('vdom slot content under a vapor <svg>', () => {
    const Child = defineVaporComponent({
      setup() {
        const root = template('<svg></svg>', 1)() as any
        insert(createSlot('default', null) as any, root)
        return root
      },
    })
    mount(
      defineComponent({
        setup: () => () =>
          h(Child as any, null, { default: () => [h('rect')] }),
      }),
    )
    expect(host.querySelector('rect')!.namespaceURI).toBe(svgNS)
  })

  test('multiple vdom slot children under a vapor <svg>', () => {
    const Child = defineVaporComponent({
      setup() {
        const root = template('<svg></svg>', 1)() as any
        insert(createSlot('default', null) as any, root)
        return root
      },
    })
    mount(
      defineComponent({
        setup: () => () =>
          h(Child as any, null, { default: () => [h('rect'), h('circle')] }),
      }),
    )
    expect(host.querySelector('rect')!.namespaceURI).toBe(svgNS)
    expect(host.querySelector('circle')!.namespaceURI).toBe(svgNS)
  })

  // coverage guard: green before the fix too (undefined happened to be right),
  // but it is what stops `<foreignObject>` from being treated as an SVG parent.
  test('vdom component under <svg><foreignObject> stays HTML', () => {
    const Div = defineComponent({ setup: () => () => h('div', 'x') })
    mount(
      vaporHost(
        '<svg><foreignObject></foreignObject></svg>',
        1,
        () => createComponent(Div as any),
        root => root.firstChild,
      ),
    )
    expect(host.querySelector('div')!.namespaceURI).toBe(htmlNS)
  })

  // Locks the annotation-xml rule added to `getContainerType`. Without it the
  // helper reports 'mathml' here and the <div> is created in the MathML
  // namespace — i.e. reusing getContainerType as-is would regress this.
  test('vdom component under <annotation-xml encoding="text/html"> stays HTML', () => {
    const Div = defineComponent({ setup: () => () => h('div', 'x') })
    mount(
      vaporHost(
        '<math><annotation-xml encoding="text/html"></annotation-xml></math>',
        2,
        () => createComponent(Div as any),
        root => root.firstChild,
      ),
    )
    expect(host.querySelector('div')!.namespaceURI).toBe(htmlNS)
  })

  test('vdom component under a non-html annotation-xml stays MathML', () => {
    const Mi = defineComponent({ setup: () => () => h('mi', 'x') })
    mount(
      vaporHost(
        '<math><annotation-xml encoding="MathML-Content"></annotation-xml></math>',
        2,
        () => createComponent(Mi as any),
        root => root.firstChild,
      ),
    )
    expect(host.querySelector('mi')!.namespaceURI).toBe(mathmlNS)
  })

  // The namespace is captured once from the real container. Re-reading it per
  // patch would report HTML while the content is parked in the detached
  // DocumentFragment a shared fallback swaps in.
  test('slot content keeps its namespace across a fallback park/restore', async () => {
    const show = ref(true)
    const Child = defineVaporComponent({
      setup() {
        const root = template('<svg></svg>', 1)() as any
        insert(
          createSlot('default', null, () =>
            template('<text>fb</text>', 0, 1)(),
          ) as any,
          root,
        )
        return root
      },
    })
    mount(
      defineComponent({
        setup: () => () =>
          h(Child as any, null, {
            default: () => (show.value ? [h('rect')] : []),
          }),
      }),
    )
    expect(host.querySelector('rect')!.namespaceURI).toBe(svgNS)
    show.value = false
    await nextTick()
    expect(host.querySelector('rect')).toBe(null)
    show.value = true
    await nextTick()
    expect(host.querySelector('rect')!.namespaceURI).toBe(svgNS)
  })

  // Known, deliberately unfixed: vapor templates bake their namespace at
  // compile time, so a vapor component whose root is an SVG *child* element
  // (<circle>/<g>/<path>) renders in the HTML namespace. Not an interop bug —
  // it reproduces in a pure vapor tree too. A vapor component rooted at <svg>
  // itself is fine. Fixing it needs a creation-time ambient namespace plus
  // per-namespace template caching; see namespace.md §6.2 for the revival
  // conditions.
  test.todo('vapor component rooted at an svg child, used inside an <svg>')
})
