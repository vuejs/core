import {
  type Ref,
  inject,
  nextTick,
  onUpdated,
  provide,
  ref,
  watch,
  watchEffect,
} from '@vue/runtime-dom'
import {
  createComponent,
  createIf,
  createTextNode,
  renderEffect,
  setText,
  template,
} from '../src'
import { makeRender } from './_utils'
import type { VaporComponentInstance } from '../src/component'

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
        renderEffect(() => setText(n0, n.value))
        return n0
      },
    })

    const { host } = define({
      setup() {
        const n = ref(0)
        provide('foo', n)
        const n0 = template('<div></div>')()
        renderEffect(() => setText(n0, n.value))
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
        renderEffect(() => setText(n0, props.value))
        return n0
      },
    })

    const outer = ref(0)
    const { host } = define({
      setup() {
        const inner = ref(0)
        const n0 = template('<div></div>')()
        renderEffect(() => setText(n0, inner.value))
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

  it('child only updates once when triggered in multiple ways', async () => {
    const a = ref(0)
    const calls: string[] = []

    const { component: Child } = define({
      props: ['count'],
      setup(props: any) {
        onUpdated(() => calls.push('update child'))
        return createTextNode(() => [`${props.count} - ${a.value}`])
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
        const n1 = createTextNode(() => [
          `${globalCount.value} - ${props.count}`,
        ])
        const n2 = createComponent(Child, { count: () => parentCount.value })
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
          setText(n1, props.text)
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

  it('unmount component', async () => {
    const { host, app, instance } = define(() => {
      const count = ref(0)
      const t0 = template('<div></div>')
      const n0 = t0()
      watchEffect(() => {
        setText(n0, count.value)
      })
      renderEffect(() => {})
      return n0
    }).render()

    const i = instance as VaporComponentInstance
    expect(i.scope.effects.length).toBe(2)
    expect(host.innerHTML).toBe('<div>0</div>')

    app.unmount()
    expect(host.innerHTML).toBe('')
    expect(i.scope.effects.length).toBe(0)
  })

  it('warn if functional vapor component not return a block', () => {
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
})
