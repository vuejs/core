import {
  createComponent,
  createSlot,
  createTextNode,
  defineVaporComponent,
  delegate,
  delegateEvents,
  insert,
  renderEffect,
  setDynamicProps,
  setText,
  template,
} from '../src'
import { nextTick, reactive, ref, watchEffect } from '@vue/runtime-dom'
import { makeRender } from './_utils'

const define = makeRender()

describe('api: setup context', () => {
  it('should expose return values to template render context', () => {
    const { html } = define({
      setup() {
        return {
          ref: ref('foo'),
          object: reactive({ msg: 'bar' }),
          value: 'baz',
        }
      },
      render(ctx) {
        return createTextNode(`${ctx.ref} ${ctx.object.msg} ${ctx.value}`)
      },
    }).render()
    expect(html()).toMatch(`foo bar baz`)
  })

  it('should support returning render function', () => {
    const { html } = define({
      setup() {
        return createTextNode(`hello`)
      },
    }).render()
    expect(html()).toMatch(`hello`)
  })

  it('props', async () => {
    const count = ref(0)
    let dummy

    const Child = defineVaporComponent({
      props: { count: Number },
      setup(props) {
        watchEffect(() => {
          dummy = props.count
        })
        const n = createTextNode()
        renderEffect(() => {
          setText(n, props.count)
        })
        return n
      },
    })

    const { html } = define({
      render: () => createComponent(Child, { count: () => count.value }),
    }).render()

    expect(html()).toMatch(`0`)

    count.value++
    await nextTick()
    expect(dummy).toBe(1)
    expect(html()).toMatch(`1`)
  })

  it('context.attrs', async () => {
    const toggle = ref(true)

    const Child = defineVaporComponent({
      inheritAttrs: false,
      setup(_props, { attrs }) {
        const el = document.createElement('div')
        renderEffect(() => setDynamicProps(el, [attrs]))
        return el
      },
    })

    const { html } = define({
      render: () =>
        createComponent(Child, {
          $: [() => (toggle.value ? { id: 'foo' } : { class: 'baz' })],
        }),
    }).render()

    expect(html()).toMatch(`<div id="foo"></div>`)

    toggle.value = false
    await nextTick()
    expect(html()).toMatch(`<div class="baz"></div>`)
  })

  // #4161
  it('context.attrs in child component slots', async () => {
    const toggle = ref(true)

    const Wrapper = defineVaporComponent({
      setup(_) {
        const n0 = createSlot('default')
        return n0
      },
    })

    const Child = defineVaporComponent({
      inheritAttrs: false,
      setup(_: any, { attrs }: any) {
        const n0 = createComponent(Wrapper, null, {
          default: () => {
            const n0 = template('<div>')() as HTMLDivElement
            renderEffect(() => setDynamicProps(n0, [attrs]))
            return n0
          },
        })
        return n0
      },
    })

    const { html } = define({
      render: () =>
        createComponent(Child, {
          $: [() => (toggle.value ? { id: 'foo' } : { class: 'baz' })],
        }),
    }).render()

    expect(html()).toMatch(`<div id="foo"></div>`)

    // should update even though it's not reactive
    toggle.value = false
    await nextTick()
    expect(html()).toMatch(`<div class="baz"></div>`)
  })

  it('context.slots', async () => {
    const id = ref('foo')

    const Child = defineVaporComponent({
      render() {
        return [createSlot('foo'), createSlot('bar')]
      },
    })

    const { html } = define({
      render() {
        return createComponent(Child, null, {
          $: [
            () => ({
              name: 'foo',
              fn: () => {
                const n = createTextNode()
                renderEffect(() => setText(n, id.value))
                return n
              },
            }),
            () => ({
              name: 'bar',
              fn: () => createTextNode('bar'),
            }),
          ],
        })
      },
    }).render()

    expect(html()).toMatch(`foo<!--slot-->bar<!--slot-->`)

    id.value = 'baz'
    await nextTick()
    expect(html()).toMatch(`baz<!--slot-->bar<!--slot-->`)
  })

  it('context.emit', async () => {
    const count = ref(0)
    const spy = vi.fn()

    delegateEvents('click')

    const Child = defineVaporComponent({
      props: {
        count: { type: Number, default: 1 },
      },
      setup(props, { emit }) {
        const n0 = template('<div>')() as HTMLDivElement
        delegate(n0, 'click', () => {
          emit('inc', props.count + 1)
        })
        const n = createTextNode()
        renderEffect(() => setText(n, props.count))
        insert(n, n0)
        return n0
      },
    })

    const { host, html } = define({
      render: () =>
        createComponent(Child, {
          count: () => count.value,
          onInc: () => (newVal: number) => {
            spy()
            count.value = newVal
          },
        }),
    }).render()

    expect(html()).toMatch(`<div>0</div>`)
    ;(host.children[0] as HTMLDivElement).click()

    expect(spy).toHaveBeenCalled()
    await nextTick()
    expect(html()).toMatch(`<div>1</div>`)
  })
})
