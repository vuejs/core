import {
  type EffectScope,
  ReactiveEffect,
  type Ref,
  inject,
  nextTick,
  onBeforeMount,
  onMounted,
  onUpdated,
  provide,
  ref,
  toDisplayString,
  useAttrs,
  watch,
  watchEffect,
} from '@vue/runtime-dom'
import {
  createComponent,
  createIf,
  createTextNode,
  defineVaporComponent,
  renderEffect,
  setInsertionState,
  template,
  txt,
} from '../src'
import { compile, compileToVaporRender, makeRender } from './_utils'
import type { VaporComponentInstance } from '../src/component'
import { setElementText, setText } from '../src/dom/prop'

const define = makeRender()

describe('component', () => {
  it('should update parent(hoc) component host el when child component self update', async () => {
    const value = ref(true)
    let childNode1: Node | null = null
    let childNode2: Node | null = null

    const { component: Child } = define({
      setup() {
        return createIf(
          () => value.value,
          () => (childNode1 = template('<div></div>')()),
          () => (childNode2 = template('<span></span>')()),
        )
      },
    })

    const { host } = define({
      setup() {
        return createComponent(Child)
      },
    }).render()

    expect(host.innerHTML).toBe('<div></div><!--if-->')
    expect(host.children[0]).toBe(childNode1)

    value.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<span></span><!--if-->')
    expect(host.children[0]).toBe(childNode2)
  })

  it('should create a component with props', () => {
    const { component: Comp } = define({
      setup() {
        return template('<div>', true)()
      },
    })

    const { host } = define({
      setup() {
        return createComponent(Comp, { id: () => 'foo', class: () => 'bar' })
      },
    }).render()

    expect(host.innerHTML).toBe('<div id="foo" class="bar"></div>')
  })

  it('should not update Component if only changed props are declared emit listeners', async () => {
    const updatedSyp = vi.fn()
    const { component: Comp } = define({
      emits: ['foo'],
      setup() {
        onUpdated(updatedSyp)
        return template('<div>', true)()
      },
    })

    const toggle = ref(true)
    const fn1 = () => {}
    const fn2 = () => {}
    define({
      setup() {
        const _on_foo = () => (toggle.value ? fn1() : fn2())
        return createComponent(Comp, { onFoo: () => _on_foo })
      },
    }).render()
    expect(updatedSyp).toHaveBeenCalledTimes(0)

    toggle.value = false
    await nextTick()
    expect(updatedSyp).toHaveBeenCalledTimes(0)
  })

  it('component child synchronously updating parent state should trigger parent re-render', async () => {
    const { component: Child } = define({
      setup() {
        const n = inject<Ref<number>>('foo')!
        n.value++
        const n0 = template('<div></div>')()
        renderEffect(() => setElementText(n0, n.value))
        return n0
      },
    })

    const { host } = define({
      setup() {
        const n = ref(0)
        provide('foo', n)
        const n0 = template('<div></div>')()
        renderEffect(() => setElementText(n0, n.value))
        return [n0, createComponent(Child)]
      },
    }).render()

    expect(host.innerHTML).toBe('<div>0</div><div>1</div>')
    await nextTick()
    expect(host.innerHTML).toBe('<div>1</div><div>1</div>')
  })

  it('component child updating parent state in pre-flush should trigger parent re-render', async () => {
    const { component: Child } = define({
      props: ['value'],
      setup(props: any, { emit }) {
        watch(
          () => props.value,
          val => emit('update', val),
        )
        const n0 = template('<div></div>')()
        renderEffect(() => setElementText(n0, props.value))
        return n0
      },
    })

    const outer = ref(0)
    const { host } = define({
      setup() {
        const inner = ref(0)
        const n0 = template('<div></div>')()
        renderEffect(() => setElementText(n0, inner.value))
        const n1 = createComponent(Child, {
          value: () => outer.value,
          onUpdate: () => (val: number) => (inner.value = val),
        })
        return [n0, n1]
      },
    }).render()

    expect(host.innerHTML).toBe('<div>0</div><div>0</div>')
    outer.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div>1</div><div>1</div>')
  })

  it('events in dynamic props', async () => {
    const { component: Child } = define({
      props: ['count'],
      setup(props: any, { emit }) {
        emit('update', props.count + 1)
        const n0 = template('<div></div>')()
        renderEffect(() => setElementText(n0, props.count))
        return n0
      },
    })

    const count = ref(0)
    const { host } = define({
      setup() {
        const n0 = createComponent(Child, {
          $: [
            () => ({
              count: count.value,
            }),
            { onUpdate: () => (val: number) => (count.value = val) },
          ],
        })
        return n0
      },
    }).render()

    expect(host.innerHTML).toBe('<div>1</div>')
  })

  it('child only updates once when triggered in multiple ways', async () => {
    const a = ref(0)
    const calls: string[] = []

    const { component: Child } = define({
      props: ['count'],
      setup(props: any) {
        onUpdated(() => calls.push('update child'))
        const n = createTextNode()
        renderEffect(() => {
          setText(n, `${props.count} - ${a.value}`)
        })
        return n
      },
    })

    const { host } = define({
      setup() {
        return createComponent(Child, { count: () => a.value })
      },
    }).render()

    expect(host.innerHTML).toBe('0 - 0')
    expect(calls).toEqual([])

    // This will trigger child rendering directly, as well as via a prop change
    a.value++
    await nextTick()
    expect(host.innerHTML).toBe('1 - 1')
    expect(calls).toEqual(['update child'])
  })

  it(`an earlier update doesn't lead to excessive subsequent updates`, async () => {
    const globalCount = ref(0)
    const parentCount = ref(0)
    const calls: string[] = []

    const { component: Child } = define({
      props: ['count'],
      setup(props: any) {
        watch(
          () => props.count,
          () => {
            calls.push('child watcher')
            globalCount.value = props.count
          },
        )
        onUpdated(() => calls.push('update child'))
        return []
      },
    })

    const { component: Parent } = define({
      props: ['count'],
      setup(props: any) {
        onUpdated(() => calls.push('update parent'))
        const n1 = createTextNode()
        const n2 = createComponent(Child, { count: () => parentCount.value })
        renderEffect(() => {
          setText(n1, `${globalCount.value} - ${props.count}`)
        })
        return [n1, n2]
      },
    })

    const { host } = define({
      setup() {
        onUpdated(() => calls.push('update root'))
        return createComponent(Parent, { count: () => globalCount.value })
      },
    }).render()

    expect(host.innerHTML).toBe(`0 - 0`)
    expect(calls).toEqual([])

    parentCount.value++
    await nextTick()
    expect(host.innerHTML).toBe(`1 - 1`)
    expect(calls).toEqual(['child watcher', 'update parent'])
  })

  it('child component props update should not lead to double update', async () => {
    const text = ref(0)
    const spy = vi.fn()

    const { component: Comp } = define({
      props: ['text'],
      setup(props: any) {
        const n1 = template('<h1></h1>')()
        renderEffect(() => {
          spy()
          setElementText(n1, props.text)
        })
        return n1
      },
    })

    const { host } = define({
      setup() {
        return createComponent(Comp, { text: () => text.value })
      },
    }).render()

    expect(host.innerHTML).toBe('<h1>0</h1>')
    expect(spy).toHaveBeenCalledTimes(1)

    text.value++
    await nextTick()
    expect(host.innerHTML).toBe('<h1>1</h1>')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('properly mount child component when using setInsertionState', async () => {
    const spy = vi.fn()

    const { component: Comp } = define({
      setup() {
        onMounted(spy)
        return template('<h1>hi</h1>')()
      },
    })

    const { host } = define({
      setup() {
        const n2 = template('<div></div>', true)()
        setInsertionState(n2 as any)
        createComponent(Comp)
        return n2
      },
    }).render()

    expect(host.innerHTML).toBe('<div><h1>hi</h1></div>')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('unmount component', async () => {
    const { host, app, instance } = define(() => {
      const count = ref(0)
      const t0 = template('<div></div>')
      const n0 = t0()
      watchEffect(() => {
        setElementText(n0, count.value)
      })
      renderEffect(() => {})
      return n0
    }).render()

    const i = instance as VaporComponentInstance
    // watchEffect + renderEffect + props validation effect
    expect(getEffectsCount(i.scope)).toBe(3)
    expect(host.innerHTML).toBe('<div>0</div>')

    app.unmount()
    expect(host.innerHTML).toBe('')
    expect(getEffectsCount(i.scope)).toBe(0)
  })

  it('work with v-once + props', () => {
    const Child = defineVaporComponent({
      props: {
        count: Number,
      },
      setup(props) {
        const n0 = template(' ')() as any
        renderEffect(() => setText(n0, String(props.count)))
        return n0
      },
    })

    const count = ref(0)
    const { html } = define({
      setup() {
        return createComponent(
          Child,
          { count: () => count.value },
          null,
          true,
          true, // v-once
        )
      },
    }).render()

    expect(html()).toBe('0')

    count.value++
    expect(html()).toBe('0')
  })

  it('work with v-once + attrs', () => {
    const Child = defineVaporComponent({
      setup() {
        const attrs = useAttrs()
        const n0 = template(' ')() as any
        renderEffect(() => setText(n0, attrs.count as string))
        return n0
      },
    })

    const count = ref(0)
    const { html } = define({
      setup() {
        return createComponent(
          Child,
          { count: () => count.value },
          null,
          true,
          true, // v-once
        )
      },
    }).render()

    expect(html()).toBe('0')

    count.value++
    expect(html()).toBe('0')
  })

  it('v-once props should be frozen and not update when parent changes', async () => {
    const localCount = ref(0)
    const Child = defineVaporComponent({
      props: {
        count: Number,
      },
      setup(props) {
        const n0 = template('<div></div>')() as any
        renderEffect(() =>
          setElementText(n0, `${localCount.value} - ${props.count}`),
        )
        return n0
      },
    })

    const parentCount = ref(0)
    const { html } = define({
      setup() {
        return createComponent(
          Child,
          { count: () => parentCount.value },
          null,
          true,
          true, // v-once
        )
      },
    }).render()

    expect(html()).toBe('<div>0 - 0</div>')

    parentCount.value++
    await nextTick()
    expect(html()).toBe('<div>0 - 0</div>')

    localCount.value++
    await nextTick()
    expect(html()).toBe('<div>1 - 0</div>')
  })

  it('v-once attrs should be frozen and not update when parent changes', async () => {
    const localCount = ref(0)
    const Child = defineVaporComponent({
      inheritAttrs: false,
      setup() {
        const attrs = useAttrs()
        const n0 = template('<div></div>')() as any
        renderEffect(() =>
          setElementText(n0, `${localCount.value} - ${attrs.count}`),
        )
        return n0
      },
    })

    const parentCount = ref(0)
    const { html } = define({
      setup() {
        return createComponent(
          Child,
          { count: () => parentCount.value },
          null,
          true,
          true, // v-once
        )
      },
    }).render()

    expect(html()).toBe('<div>0 - 0</div>')

    parentCount.value++
    await nextTick()
    expect(html()).toBe('<div>0 - 0</div>')

    localCount.value++
    await nextTick()
    expect(html()).toBe('<div>1 - 0</div>')
  })

  test('should mount component only with template in production mode', () => {
    __DEV__ = false
    try {
      const { component: Child } = define({
        render() {
          return template('<div> HI </div>', true)()
        },
      })

      const { host } = define({
        setup() {
          return createComponent(Child, null, null, true)
        },
      }).render()

      expect(host.innerHTML).toBe('<div> HI </div>')
    } finally {
      __DEV__ = true
    }
  })

  test('should pass slot args to template-only component render in production mode', () => {
    __DEV__ = false
    try {
      const { component: Child } = define({
        render: compileToVaporRender(
          `<span v-if="$slots.default"><slot /></span>`,
          { bindingMetadata: {} },
        ),
      })

      const { host } = define({
        setup() {
          return createComponent(Child, null, {
            default: () => template('<button>slot</button>')(),
          })
        },
      }).render()

      expect(host.innerHTML).toBe('<span><button>slot</button></span>')
    } finally {
      __DEV__ = true
    }
  })

  it('warn if functional vapor component not return a block', () => {
    // @ts-expect-error
    define(() => {
      return () => {}
    }).render()

    expect(
      'Functional vapor component must return a block directly',
    ).toHaveBeenWarned()
  })

  it('warn if setup return a function and no render function', () => {
    define({
      setup() {
        return () => []
      },
    }).render()

    expect(
      'Vapor component setup() returned non-block value, and has no render function',
    ).toHaveBeenWarned()
  })

  it('warn non-existent property access', () => {
    define({
      setup() {
        return {}
      },
      render(ctx: any) {
        ctx.foo
        return []
      },
    }).render()

    expect(
      'Property "foo" was accessed during render but is not defined on instance.',
    ).toHaveBeenWarned()
  })

  test('display attrs', () => {
    const App = defineVaporComponent({
      props: {},
      emits: [],
      setup(props, { attrs }) {
        const n0 = template('<div> ')() as any
        const x0 = txt(n0) as any
        renderEffect(() => setText(x0, toDisplayString(attrs)))
        return n0
      },
    })
    const { render } = define(App)
    expect(render).not.toThrow(TypeError)
    expect(
      'Unhandled error during execution of setup function',
    ).not.toHaveBeenWarned()
  })

  it('mounts plain template elements with dynamic descendants', async () => {
    const msg = ref('12')
    const Comp = compile(
      `<script setup vapor>
        const msg = _data
      </script>
      <template>
        <template>
          <div>{{ msg }}</div>
        </template>
      </template>`,
      msg,
    )

    const { host } = define(Comp).render()
    const templateEl = host.firstChild as HTMLTemplateElement
    expect(templateEl.tagName).toBe('TEMPLATE')

    const div = templateEl.firstChild as HTMLDivElement
    expect(div.tagName).toBe('DIV')
    expect(div.textContent).toBe('12')

    msg.value = '34'
    await nextTick()
    expect(div.textContent).toBe('34')
  })

  it('mounts plain template elements with dynamic text children', async () => {
    const msg = ref('12')
    const Comp = compile(
      `<script setup vapor>
        const msg = _data
      </script>
      <template>
        <template>
          {{ msg }}
        </template>
      </template>`,
      msg,
    )

    const { host } = define(Comp).render()
    const templateEl = host.firstChild as HTMLTemplateElement
    expect(templateEl.tagName).toBe('TEMPLATE')
    expect(templateEl.firstChild!.nodeType).toBe(Node.TEXT_NODE)
    expect(templateEl.textContent).toBe('12')

    msg.value = '34'
    await nextTick()
    expect(templateEl.textContent).toBe('34')
  })

  it('mounts plain template literal interpolation as text', () => {
    const Comp = compile(
      `<template>
        <template>{{ "<b>foo</b>" }}</template>
      </template>`,
      ref('unused'),
    )

    const { host } = define(Comp).render()
    const templateEl = host.firstChild as HTMLTemplateElement
    expect(templateEl.tagName).toBe('TEMPLATE')
    expect(templateEl.firstChild!.nodeType).toBe(Node.TEXT_NODE)
    expect(templateEl.textContent).toBe('<b>foo</b>')
  })

  it('mounts plain template literal v-text as text', () => {
    const Comp = compile(
      `<template>
        <template v-text="'<b>foo</b>'"></template>
      </template>`,
      ref('unused'),
    )

    const { host } = define(Comp).render()
    const templateEl = host.firstChild as HTMLTemplateElement
    expect(templateEl.tagName).toBe('TEMPLATE')
    expect(templateEl.firstChild!.nodeType).toBe(Node.TEXT_NODE)
    expect(templateEl.textContent).toBe('<b>foo</b>')
  })

  it('mounts plain template elements with slot content', () => {
    const data = ref('unused')
    const Child = compile(
      `<template>
        <template><slot /></template>
      </template>`,
      data,
    )
    const Parent = compile(
      `<template><components.Child><div>slot child</div></components.Child></template>`,
      data,
      { Child },
    )

    const { host } = define(Parent).render()
    const templateEl = host.firstChild as HTMLTemplateElement
    expect(templateEl.tagName).toBe('TEMPLATE')
    expect(templateEl.firstChild).toBeInstanceOf(HTMLDivElement)
    expect(templateEl.firstChild!.textContent).toBe('slot child')
  })

  it('mounts plain template elements with v-html', () => {
    const msg = ref('<b>foo</b>')
    const Comp = compile(
      `<script setup vapor>
        const msg = _data
      </script>
      <template>
        <template v-html="msg"></template>
      </template>`,
      msg,
    )

    const { host } = define(Comp).render()
    const templateEl = host.firstChild as HTMLTemplateElement
    expect(templateEl.tagName).toBe('TEMPLATE')
    expect(templateEl.innerHTML.toLowerCase()).toBe('<b>foo</b>')
    expect(templateEl.content.firstChild).toBeInstanceOf(HTMLElement)
    expect((templateEl.content.firstChild as HTMLElement).tagName).toBe('B')
  })

  it('mounts plain template elements with v-text', async () => {
    const msg = ref('12')
    const Comp = compile(
      `<script setup vapor>
        const msg = _data
      </script>
      <template>
        <template v-text="msg"></template>
      </template>`,
      msg,
    )

    const { host } = define(Comp).render()
    const templateEl = host.firstChild as HTMLTemplateElement
    expect(templateEl.tagName).toBe('TEMPLATE')
    expect(templateEl.textContent).toBe('12')

    msg.value = '34'
    await nextTick()
    expect(templateEl.textContent).toBe('34')
  })

  it('should invalidate pending mounted hooks when unmounted before flush', async () => {
    const mountedSpy = vi.fn()
    const show = ref(false)

    const Child = defineVaporComponent({
      setup() {
        onBeforeMount(() => {
          show.value = false
        })
        onMounted(mountedSpy)
        return template('<div>child</div>')()
      },
    })

    define({
      setup() {
        return createIf(
          () => show.value,
          () => createComponent(Child),
        )
      },
    }).render()

    expect(mountedSpy).toHaveBeenCalledTimes(0)

    show.value = true
    await nextTick()

    expect(mountedSpy).toHaveBeenCalledTimes(0)
  })
})

function getEffectsCount(scope: EffectScope): number {
  let n = 0
  for (let dep = scope.deps; dep !== undefined; dep = dep.nextDep) {
    if (dep.dep instanceof ReactiveEffect) {
      n++
    }
  }
  return n
}
