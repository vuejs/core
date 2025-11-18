import { type HMRRuntime, nextTick, ref } from '@vue/runtime-dom'
import { compileToVaporRender as compileToFunction, makeRender } from './_utils'
import { defineVaporComponent, delegateEvents } from '@vue/runtime-vapor'

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
      render: compileToFunction('<div><slot/></div>'),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      __hmrId: parentId,
      // @ts-expect-error ObjectVaporComponent doesn't have components
      components: { Child },
      setup() {
        const count = ref(0)
        return { count }
      },
      render: compileToFunction(
        `<div @click="count++">{{ count }}<Child>{{ count }}</Child></div>`,
      ),
    })
    createRecord(parentId, Parent as any)

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
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}!<Child>{{ count }}</Child></div>`,
      ),
    )
    expect(root.innerHTML).toBe(`<div>1!<div>1<!--slot--></div></div>`)

    // Should force child update on slot content change
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}!<Child>{{ count }}!</Child></div>`,
      ),
    )
    expect(root.innerHTML).toBe(`<div>1!<div>1!<!--slot--></div></div>`)

    // Should force update element children despite block optimization
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}<span>{{ count }}</span>
      <Child>{{ count }}!</Child>
    </div>`,
      ),
    )
    expect(root.innerHTML).toBe(
      `<div>1<span>1</span><div>1!<!--slot--></div></div>`,
    )

    // Should force update child slot elements
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">
      <Child><span>{{ count }}</span></Child>
    </div>`,
      ),
    )
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
      render: compileToFunction(`<div>{{ msg }}</div>`),
    })
    createRecord(childId, Child as any)

    const { mount, component: Parent } = define({
      __hmrId: parentId,
      // @ts-expect-error
      components: { Child },
      setup() {
        const msg = ref('root')
        return { msg }
      },
      render: compileToFunction(`<Child/><div>{{ msg }}</div>`),
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
      render: compileToFunction(`<div>{{ msg }}</div>`),
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
      render: compileToFunction(`<div>{{ msg }}</div>`),
    })
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>child changed2</div><div>root</div>"`,
    )

    // reload parent
    reload(parentId, {
      __hmrId: parentId,
      __vapor: true,
      // @ts-expect-error
      components: { Child },
      setup() {
        const msg = ref('root changed')
        return { msg }
      },
      render: compileToFunction(`<Child/><div>{{ msg }}</div>`),
    })
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div>child changed2</div><div>root changed</div>"`,
    )
  })
})
