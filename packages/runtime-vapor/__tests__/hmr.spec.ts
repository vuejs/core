// TODO: port tests from packages/runtime-core/__tests__/hmr.spec.ts

import {
  type HMRRuntime,
  nextTick,
  ref,
  toDisplayString,
} from '@vue/runtime-dom'
import { makeRender } from './_utils'
import {
  child,
  createComponent,
  createComponentWithFallback,
  createInvoker,
  createSlot,
  defineVaporComponent,
  delegateEvents,
  next,
  renderEffect,
  setInsertionState,
  setText,
  template,
  txt,
  withVaporCtx,
} from '@vue/runtime-vapor'

declare var __VUE_HMR_RUNTIME__: HMRRuntime
const { createRecord, rerender, reload } = __VUE_HMR_RUNTIME__

const define = makeRender()

const triggerEvent = (type: string, el: Element) => {
  const event = new Event(type, { bubbles: true })
  el.dispatchEvent(event)
}
delegateEvents('click')

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('hot module replacement', () => {
  test('inject global runtime', () => {
    expect(createRecord).toBeDefined()
    expect(rerender).toBeDefined()
    expect(reload).toBeDefined()
  })

  test('createRecord', () => {
    expect(createRecord('test1', {})).toBe(true)
    // if id has already been created, should return false
    expect(createRecord('test1', {})).toBe(false)
  })

  test('rerender', async () => {
    const root = document.createElement('div')
    const parentId = 'test2-parent'
    const childId = 'test2-child'
    document.body.appendChild(root)

    const Child = defineVaporComponent({
      __hmrId: childId,
      render() {
        const n1 = template('<div></div>', true)() as any
        setInsertionState(n1, null, true)
        createSlot('default', null)
        return n1
      },
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      __hmrId: parentId,
      setup() {
        const count = ref(0)
        return { count }
      },
      render(ctx) {
        const n3 = template('<div> </div>', true)() as any
        const n0 = child(n3) as any
        setInsertionState(n3, 1, true)
        createComponent(Child, null, {
          default: withVaporCtx(() => {
            const n1 = template(' ')() as any
            renderEffect(() => setText(n1, toDisplayString(ctx.count)))
            return n1
          }),
        })
        n3.$evtclick = createInvoker(() => ctx.count++)
        renderEffect(() => setText(n0, toDisplayString(ctx.count)))
        return n3
      },
    })
    createRecord(parentId, Parent as any)

    // render(h(Parent), root)
    const { mount } = define(Parent).create()
    mount(root)
    expect(root.innerHTML).toBe(`<div>0<div>0<!--slot--></div></div>`)

    // Perform some state change. This change should be preserved after the
    // re-render!
    // triggerEvent(root.children[0] as TestElement, 'click')
    triggerEvent('click', root.children[0])
    await nextTick()
    expect(root.innerHTML).toBe(`<div>1<div>1<!--slot--></div></div>`)

    // Update text while preserving state
    rerender(parentId, (ctx: any) => {
      const n3 = template('<div> </div>', true)() as any
      const n0 = child(n3) as any
      setInsertionState(n3, 1, true)
      createComponent(Child, null, {
        default: withVaporCtx(() => {
          const n1 = template(' ')() as any
          renderEffect(() => setText(n1, toDisplayString(ctx.count)))
          return n1
        }),
      })
      n3.$evtclick = createInvoker(() => ctx.count++)
      renderEffect(() => setText(n0, toDisplayString(ctx.count) + '!'))
      return n3
    })
    expect(root.innerHTML).toBe(`<div>1!<div>1<!--slot--></div></div>`)

    // Should force child update on slot content change
    rerender(parentId, (ctx: any) => {
      const n3 = template('<div> </div>', true)() as any
      const n0 = child(n3) as any
      setInsertionState(n3, 1, true)
      createComponent(Child, null, {
        default: withVaporCtx(() => {
          const n1 = template(' ')() as any
          renderEffect(() => setText(n1, toDisplayString(ctx.count) + '!'))
          return n1
        }),
      })
      n3.$evtclick = createInvoker(() => ctx.count++)
      renderEffect(() => setText(n0, toDisplayString(ctx.count) + '!'))
      return n3
    })
    expect(root.innerHTML).toBe(`<div>1!<div>1!<!--slot--></div></div>`)

    // Should force update element children despite block optimization
    rerender(parentId, (ctx: any) => {
      const n5 = template('<div> <span> </span></div>', true)() as any
      const n0 = child(n5) as any
      const n1 = next(n0) as any
      setInsertionState(n5, 2, true)
      createComponentWithFallback(Child, null, {
        default: withVaporCtx(() => {
          const n2 = template(' ')() as any
          renderEffect(() => setText(n2, toDisplayString(ctx.count) + '!'))
          return n2
        }),
      })
      const x1 = txt(n1) as any
      n5.$evtclick = createInvoker(() => ctx.count++)
      renderEffect(() => {
        const count = ctx.count
        setText(n0, toDisplayString(count))
        setText(x1, toDisplayString(count))
      })
      return n5
    })
    expect(root.innerHTML).toBe(
      `<div>1<span>1</span><div>1!<!--slot--></div></div>`,
    )

    // Should force update child slot elements
    rerender(parentId, (ctx: any) => {
      const n2 = template('<div></div>', true)() as any
      setInsertionState(n2, null, true)
      createComponentWithFallback(Child, null, {
        default: withVaporCtx(() => {
          const n0 = template('<span> </span>')() as any
          const x0 = txt(n0) as any
          renderEffect(() => setText(x0, toDisplayString(ctx.count)))
          return n0
        }),
      })
      n2.$evtclick = createInvoker(() => ctx.count++)
      return n2
    })
    expect(root.innerHTML).toBe(
      `<div><div><span>1</span><!--slot--></div></div>`,
    )
  })

  test('reload', async () => {
    // const root = nodeOps.createElement('div')
    // const childId = 'test3-child'
    // const unmountSpy = vi.fn()
    // const mountSpy = vi.fn()
    // const Child: ComponentOptions = {
    //   __hmrId: childId,
    //   data() {
    //     return { count: 0 }
    //   },
    //   unmounted: unmountSpy,
    //   render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    // }
    // createRecord(childId, Child)
    // const Parent: ComponentOptions = {
    //   render: () => h(Child),
    // }
    // render(h(Parent), root)
    // expect(serializeInner(root)).toBe(`<div>0</div>`)
    // reload(childId, {
    //   __hmrId: childId,
    //   data() {
    //     return { count: 1 }
    //   },
    //   mounted: mountSpy,
    //   render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    // })
    // await nextTick()
    // expect(serializeInner(root)).toBe(`<div>1</div>`)
    // expect(unmountSpy).toHaveBeenCalledTimes(1)
    // expect(mountSpy).toHaveBeenCalledTimes(1)
  })

  test('child reload + parent reload', async () => {
    const root = document.createElement('div')
    const childId = 'test1-child-reload'
    const parentId = 'test1-parent-reload'

    const { component: Child } = define({
      __hmrId: childId,
      setup() {
        const msg = ref('child')
        return { msg }
      },
      render(ctx) {
        const n0 = template(`<div> </div>`)()
        const x0 = child(n0 as any)
        renderEffect(() => setText(x0 as any, ctx.msg))
        return [n0]
      },
    })
    createRecord(childId, Child as any)

    const { mount, component: Parent } = define({
      __hmrId: parentId,
      setup() {
        const msg = ref('root')
        return { msg }
      },
      render(ctx) {
        const n0 = createComponent(Child)
        const n1 = template(`<div> </div>`)()
        const x0 = child(n1 as any)
        renderEffect(() => setText(x0 as any, ctx.msg))
        return [n0, n1]
      },
    }).create()
    createRecord(parentId, Parent as any)
    mount(root)

    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>child</div><div>root</div>"`,
    )

    // reload child
    reload(childId, {
      __hmrId: childId,
      __vapor: true,
      setup() {
        const msg = ref('child changed')
        return { msg }
      },
      render(ctx: any) {
        const n0 = template(`<div> </div>`)()
        const x0 = child(n0 as any)
        renderEffect(() => setText(x0 as any, ctx.msg))
        return [n0]
      },
    })
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>child changed</div><div>root</div>"`,
    )

    // reload child again
    reload(childId, {
      __hmrId: childId,
      __vapor: true,
      setup() {
        const msg = ref('child changed2')
        return { msg }
      },
      render(ctx: any) {
        const n0 = template(`<div> </div>`)()
        const x0 = child(n0 as any)
        renderEffect(() => setText(x0 as any, ctx.msg))
        return [n0]
      },
    })
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>child changed2</div><div>root</div>"`,
    )

    // reload parent
    reload(parentId, {
      __hmrId: parentId,
      __vapor: true,
      setup() {
        const msg = ref('root changed')
        return { msg }
      },
      render(ctx: any) {
        const n0 = createComponent(Child)
        const n1 = template(`<div> </div>`)()
        const x0 = child(n1 as any)
        renderEffect(() => setText(x0 as any, ctx.msg))
        return [n0, n1]
      },
    })
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>child changed2</div><div>root changed</div>"`,
    )
  })
})
