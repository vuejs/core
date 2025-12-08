import {
  type HMRRuntime,
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  toDisplayString,
} from '@vue/runtime-dom'
import { compileToVaporRender as compileToFunction, makeRender } from './_utils'
import {
  createComponent,
  createSlot,
  createTemplateRefSetter,
  defineVaporAsyncComponent,
  defineVaporComponent,
  delegateEvents,
  renderEffect,
  setText,
  template,
  withVaporCtx,
} from '@vue/runtime-vapor'
import { BindingTypes } from '@vue/compiler-core'
import type { VaporComponent } from '../src/component'

declare var __VUE_HMR_RUNTIME__: HMRRuntime
const { createRecord, rerender, reload } = __VUE_HMR_RUNTIME__

const define = makeRender()
const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

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
    const root = document.createElement('div')
    const childId = 'test3-child'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()
    const Child = defineVaporComponent({
      __hmrId: childId,
      setup() {
        onUnmounted(unmountSpy)
        const count = ref(0)
        return { count }
      },
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      __hmrId: 'parentId',
      render: () => createComponent(Child),
    })

    define(Parent).create().mount(root)
    expect(root.innerHTML).toBe(`<div>0</div>`)

    reload(childId, {
      __hmrId: childId,
      setup() {
        onMounted(mountSpy)
        const count = ref(1)
        return { count }
      },
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    })
    await nextTick()
    expect(root.innerHTML).toBe(`<div>1</div>`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
  })

  test('reload KeepAlive slot', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const childId = 'test-child-keep-alive'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()
    const activeSpy = vi.fn()
    const deactivatedSpy = vi.fn()

    const Child = defineVaporComponent({
      __hmrId: childId,
      setup() {
        onUnmounted(unmountSpy)
        const count = ref(0)
        return { count }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      __hmrId: 'parentId',
      components: { Child },
      setup() {
        const toggle = ref(true)
        return { toggle }
      },
      render: compileToFunction(
        `<button @click="toggle = !toggle" />
        <KeepAlive><Child v-if="toggle" /></KeepAlive>`,
      ),
    })

    define(Parent).create().mount(root)
    expect(root.innerHTML).toBe(`<button></button><div>0</div><!--if-->`)

    reload(childId, {
      __hmrId: childId,
      __vapor: true,
      setup() {
        onMounted(mountSpy)
        onUnmounted(unmountSpy)
        onActivated(activeSpy)
        onDeactivated(deactivatedSpy)
        const count = ref(1)
        return { count }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    await nextTick()
    expect(root.innerHTML).toBe(`<button></button><div>1</div><!--if-->`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactivatedSpy).toHaveBeenCalledTimes(0)

    // should not unmount when toggling
    triggerEvent('click', root.children[0] as Element)
    await nextTick()
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactivatedSpy).toHaveBeenCalledTimes(1)

    // should not mount when toggling
    triggerEvent('click', root.children[0] as Element)
    await nextTick()
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(2)
    expect(deactivatedSpy).toHaveBeenCalledTimes(1)
  })

  test('reload KeepAlive slot in Transition', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const childId = 'test-transition-keep-alive-reload'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()
    const activeSpy = vi.fn()
    const deactivatedSpy = vi.fn()

    const Child = defineVaporComponent({
      __hmrId: childId,
      setup() {
        onUnmounted(unmountSpy)
        const count = ref(0)
        return { count }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      __hmrId: 'parentId',
      components: { Child },
      setup() {
        const toggle = ref(true)
        return { toggle }
      },
      render: compileToFunction(
        `<button @click="toggle = !toggle" />
        <Transition>
          <KeepAlive><Child v-if="toggle" /></KeepAlive>
        </Transition>`,
      ),
    })

    define(Parent).create().mount(root)
    expect(root.innerHTML).toBe(`<button></button><div>0</div><!--if-->`)

    reload(childId, {
      __hmrId: childId,
      __vapor: true,
      setup() {
        onMounted(mountSpy)
        onUnmounted(unmountSpy)
        onActivated(activeSpy)
        onDeactivated(deactivatedSpy)
        const count = ref(1)
        return { count }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    await nextTick()
    expect(root.innerHTML).toBe(`<button></button><div>1</div><!--if-->`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactivatedSpy).toHaveBeenCalledTimes(0)

    // should not unmount when toggling
    triggerEvent('click', root.children[0] as Element)
    await nextTick()
    expect(root.innerHTML).toBe(`<button></button><!--if-->`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactivatedSpy).toHaveBeenCalledTimes(1)

    // should not mount when toggling
    triggerEvent('click', root.children[0] as Element)
    await nextTick()
    expect(root.innerHTML).toBe(`<button></button><div>1</div><!--if-->`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(2)
    expect(deactivatedSpy).toHaveBeenCalledTimes(1)
  })

  test('reload KeepAlive slot in Transition with out-in', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const childId = 'test-transition-keep-alive-reload-with-out-in'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()
    const activeSpy = vi.fn()
    const deactivatedSpy = vi.fn()

    const Child = defineVaporComponent({
      name: 'original',
      __hmrId: childId,
      setup() {
        onUnmounted(unmountSpy)
        const count = ref(0)
        return { count }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      components: { Child },
      setup() {
        function onLeave(_: any, done: Function) {
          setTimeout(done, 0)
        }
        const toggle = ref(true)
        return { toggle, onLeave }
      },
      render: compileToFunction(
        `<button @click="toggle = !toggle" />
        <Transition mode="out-in" @leave="onLeave">
          <KeepAlive><Child v-if="toggle" /></KeepAlive>
        </Transition>`,
      ),
    })

    define(Parent).create().mount(root)
    expect(root.innerHTML).toBe(`<button></button><div>0</div><!--if-->`)

    reload(childId, {
      name: 'updated',
      __hmrId: childId,
      __vapor: true,
      setup() {
        onMounted(mountSpy)
        onUnmounted(unmountSpy)
        onActivated(activeSpy)
        onDeactivated(deactivatedSpy)
        const count = ref(1)
        return { count }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
    expect(root.innerHTML).toBe(`<button></button><div>1</div><!--if-->`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactivatedSpy).toHaveBeenCalledTimes(0)

    // should not unmount when toggling
    triggerEvent('click', root.children[0] as Element)
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
    expect(root.innerHTML).toBe(`<button></button><!--if-->`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactivatedSpy).toHaveBeenCalledTimes(1)

    // should not mount when toggling
    triggerEvent('click', root.children[0] as Element)
    await nextTick()
    expect(root.innerHTML).toBe(`<button></button><div>1</div><!--if-->`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(2)
    expect(deactivatedSpy).toHaveBeenCalledTimes(1)
  })

  // TODO: renderEffect not re-run after child reload
  // it requires parent rerender to align with vdom
  test.todo('reload: avoid infinite recursion', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const childId = 'test-child-6930'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()

    const Child = defineVaporComponent({
      __hmrId: childId,
      setup(_, { expose }) {
        const count = ref(0)
        expose({
          count,
        })
        onUnmounted(unmountSpy)
        return { count }
      },
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      setup() {
        const com1 = ref()
        const changeRef1 = (value: any) => (com1.value = value)
        const com2 = ref()
        const changeRef2 = (value: any) => (com2.value = value)
        const setRef = createTemplateRefSetter()
        const n0 = createComponent(Child)
        setRef(n0, changeRef1)
        const n1 = createComponent(Child)
        setRef(n1, changeRef2)
        const n2 = template(' ')() as any
        renderEffect(() => {
          setText(n2, toDisplayString(com1.value.count))
        })
        return [n0, n1, n2]
      },
    })

    define(Parent).create().mount(root)
    await nextTick()
    expect(root.innerHTML).toBe(`<div>0</div><div>0</div>0`)

    reload(childId, {
      __hmrId: childId,
      __vapor: true,
      setup() {
        onMounted(mountSpy)
        const count = ref(1)
        return { count }
      },
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    })
    await nextTick()
    expect(root.innerHTML).toBe(`<div>1</div><div>1</div>1`)
    expect(unmountSpy).toHaveBeenCalledTimes(2)
    expect(mountSpy).toHaveBeenCalledTimes(2)
  })

  test('static el reference', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const id = 'test-static-el'

    const template = `<div>
    <div>{{ count }}</div>
    <button @click="count++">++</button>
  </div>`

    const Comp = defineVaporComponent({
      __hmrId: id,
      setup() {
        const count = ref(0)
        return { count }
      },
      render: compileToFunction(template),
    })
    createRecord(id, Comp as any)

    define(Comp).create().mount(root)
    expect(root.innerHTML).toBe(`<div><div>0</div><button>++</button></div>`)

    // 1. click to trigger update
    triggerEvent('click', root.children[0].children[1] as Element)
    await nextTick()
    expect(root.innerHTML).toBe(`<div><div>1</div><button>++</button></div>`)

    // 2. trigger HMR
    rerender(
      id,
      compileToFunction(template.replace(`<button`, `<button class="foo"`)),
    )
    expect(root.innerHTML).toBe(
      `<div><div>1</div><button class="foo">++</button></div>`,
    )
  })

  test('force update child component w/ static props', () => {
    const root = document.createElement('div')
    const parentId = 'test-force-props-parent'
    const childId = 'test-force-props-child'

    const Child = defineVaporComponent({
      __hmrId: childId,
      props: {
        msg: String,
      },
      render: compileToFunction(`<div>{{ msg }}</div>`, {
        bindingMetadata: {
          msg: BindingTypes.PROPS,
        },
      }),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      __hmrId: parentId,
      components: { Child },
      render: compileToFunction(`<Child msg="foo" />`),
    })
    createRecord(parentId, Parent as any)

    define(Parent).create().mount(root)
    expect(root.innerHTML).toBe(`<div>foo</div>`)

    rerender(parentId, compileToFunction(`<Child msg="bar" />`))
    expect(root.innerHTML).toBe(`<div>bar</div>`)
  })

  test('remove static class from parent', () => {
    const root = document.createElement('div')
    const parentId = 'test-force-class-parent'
    const childId = 'test-force-class-child'

    const Child = defineVaporComponent({
      __hmrId: childId,
      render: compileToFunction(`<div>child</div>`),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      __hmrId: parentId,
      components: { Child },
      render: compileToFunction(`<Child class="test" />`),
    })
    createRecord(parentId, Parent as any)

    define(Parent).create().mount(root)
    expect(root.innerHTML).toBe(`<div class="test">child</div>`)

    rerender(parentId, compileToFunction(`<Child/>`))
    expect(root.innerHTML).toBe(`<div>child</div>`)
  })

  test('rerender if any parent in the parent chain', () => {
    const root = document.createElement('div')
    const parent = 'test-force-props-parent-'
    const childId = 'test-force-props-child'

    const numberOfParents = 5

    const Child = defineVaporComponent({
      __hmrId: childId,
      render: compileToFunction(`<div>child</div>`),
    })
    createRecord(childId, Child as any)

    const components: VaporComponent[] = []

    for (let i = 0; i < numberOfParents; i++) {
      const parentId = `${parent}${i}`
      const parentComp: VaporComponent = {
        __vapor: true,
        __hmrId: parentId,
      }
      components.push(parentComp)
      if (i === 0) {
        parentComp.render = compileToFunction(`<Child />`)
        parentComp.components = {
          Child,
        }
      } else {
        parentComp.render = compileToFunction(`<Parent />`)
        parentComp.components = {
          Parent: components[i - 1],
        }
      }

      createRecord(parentId, parentComp as any)
    }

    const last = components[components.length - 1]

    define(last).create().mount(root)
    expect(root.innerHTML).toBe(`<div>child</div>`)

    rerender(last.__hmrId!, compileToFunction(`<Parent class="test"/>`))
    expect(root.innerHTML).toBe(`<div class="test">child</div>`)
  })

  test('rerender with Teleport', () => {
    const root = document.createElement('div')
    const target = document.createElement('div')
    document.body.appendChild(root)
    document.body.appendChild(target)
    const parentId = 'parent-teleport'

    const Child = defineVaporComponent({
      setup() {
        return { target }
      },
      render: compileToFunction(`
        <teleport :to="target">
          <div>
            <slot/>
          </div>
        </teleport>
      `),
    })

    const Parent = {
      __vapor: true,
      __hmrId: parentId,
      components: { Child },
      render: compileToFunction(`
        <Child>
          <template #default>
            <div>1</div>
          </template>
        </Child>
      `),
    }
    createRecord(parentId, Parent as any)

    define(Parent).create().mount(root)
    expect(root.innerHTML).toBe(`<!--teleport start--><!--teleport end-->`)
    expect(target.innerHTML).toBe(`<div><div>1</div><!--slot--></div>`)

    rerender(
      parentId,
      compileToFunction(`
      <Child>
        <template #default>
          <div>1</div>
          <div>2</div>
        </template>
      </Child>
    `),
    )
    expect(root.innerHTML).toBe(`<!--teleport start--><!--teleport end-->`)
    expect(target.innerHTML).toBe(
      `<div><div>1</div><div>2</div><!--slot--></div>`,
    )
  })

  test('rerender for component that has no active instance yet', () => {
    const id = 'no-active-instance-rerender'
    const Foo = {
      __vapor: true,
      __hmrId: id,
      render: () => template('foo')(),
    }

    createRecord(id, Foo)
    rerender(id, () => template('bar')())

    const root = document.createElement('div')
    define(Foo).create().mount(root)
    expect(root.innerHTML).toBe('bar')
  })

  test('reload for component that has no active instance yet', () => {
    const id = 'no-active-instance-reload'
    const Foo = {
      __vapor: true,
      __hmrId: id,
      render: () => template('foo')(),
    }

    createRecord(id, Foo)
    reload(id, {
      __hmrId: id,
      render: () => template('bar')(),
    })

    const root = document.createElement('div')
    define(Foo).render({}, root)
    expect(root.innerHTML).toBe('bar')
  })

  test('force update slot content change', () => {
    const root = document.createElement('div')
    const parentId = 'test-force-computed-parent'
    const childId = 'test-force-computed-child'

    const Child = {
      __vapor: true,
      __hmrId: childId,
      setup(_: any, { slots }: any) {
        const slotContent = computed(() => {
          return slots.default?.()
        })
        return { slotContent }
      },
      render: compileToFunction(`<component :is="() => slotContent" />`),
    }
    createRecord(childId, Child)

    const Parent = {
      __vapor: true,
      __hmrId: parentId,
      components: { Child },
      render: compileToFunction(`<Child>1</Child>`),
    }
    createRecord(parentId, Parent)

    // render(h(Parent), root)
    define(Parent).render({}, root)
    expect(root.innerHTML).toBe(`1<!--dynamic-component-->`)

    rerender(parentId, compileToFunction(`<Child>2</Child>`))
    expect(root.innerHTML).toBe(`2<!--dynamic-component-->`)
  })

  // #11248
  test('reload async component with multiple instances', async () => {
    const root = document.createElement('div')
    const childId = 'test-child-id'
    const Child = {
      __vapor: true,
      __hmrId: childId,
      setup() {
        const count = ref(0)
        return { count }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    }
    const Comp = defineVaporAsyncComponent(() => Promise.resolve(Child))
    const appId = 'test-app-id'
    const App = {
      __hmrId: appId,
      render() {
        return [createComponent(Comp), createComponent(Comp)]
      },
    }
    createRecord(appId, App)

    define(App).render({}, root)

    await timeout()

    expect(root.innerHTML).toBe(
      `<div>0</div><!--async component--><div>0</div><!--async component-->`,
    )

    // change count to 1
    reload(childId, {
      __vapor: true,
      __hmrId: childId,
      setup() {
        const count = ref(1)
        return { count }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    })

    await timeout()

    expect(root.innerHTML).toBe(
      `<div>1</div><!--async component--><div>1</div><!--async component-->`,
    )
  })

  test.todo('reload async child wrapped in Suspense + KeepAlive', async () => {
    //   const id = 'async-child-reload'
    //   const AsyncChild: ComponentOptions = {
    //     __hmrId: id,
    //     async setup() {
    //       await nextTick()
    //       return () => 'foo'
    //     },
    //   }
    //   createRecord(id, AsyncChild)
    //   const appId = 'test-app-id'
    //   const App: ComponentOptions = {
    //     __hmrId: appId,
    //     components: { AsyncChild },
    //     render: compileToFunction(`
    //       <div>
    //       <Suspense>
    //         <KeepAlive>
    //           <AsyncChild />
    //         </KeepAlive>
    //       </Suspense>
    //     </div>
    //     `),
    //   }
    //   const root = nodeOps.createElement('div')
    //   render(h(App), root)
    //   expect(serializeInner(root)).toBe('<div><!----></div>')
    //   await timeout()
    //   expect(serializeInner(root)).toBe('<div>foo</div>')
    //   reload(id, {
    //     __hmrId: id,
    //     async setup() {
    //       await nextTick()
    //       return () => 'bar'
    //     },
    //   })
    //   await timeout()
    //   expect(serializeInner(root)).toBe('<div>bar</div>')
  })

  test.todo('multi reload child wrapped in Suspense + KeepAlive', async () => {
    //   const id = 'test-child-reload-3'
    //   const Child: ComponentOptions = {
    //     __hmrId: id,
    //     setup() {
    //       const count = ref(0)
    //       return { count }
    //     },
    //     render: compileToFunction(`<div>{{ count }}</div>`),
    //   }
    //   createRecord(id, Child)
    //   const appId = 'test-app-id'
    //   const App: ComponentOptions = {
    //     __hmrId: appId,
    //     components: { Child },
    //     render: compileToFunction(`
    //       <KeepAlive>
    //         <Suspense>
    //           <Child />
    //         </Suspense>
    //       </KeepAlive>
    //     `),
    //   }
    //   const root = nodeOps.createElement('div')
    //   render(h(App), root)
    //   expect(serializeInner(root)).toBe('<div>0</div>')
    //   await timeout()
    //   reload(id, {
    //     __hmrId: id,
    //     setup() {
    //       const count = ref(1)
    //       return { count }
    //     },
    //     render: compileToFunction(`<div>{{ count }}</div>`),
    //   })
    //   await timeout()
    //   expect(serializeInner(root)).toBe('<div>1</div>')
    //   reload(id, {
    //     __hmrId: id,
    //     setup() {
    //       const count = ref(2)
    //       return { count }
    //     },
    //     render: compileToFunction(`<div>{{ count }}</div>`),
    //   })
    //   await timeout()
    //   expect(serializeInner(root)).toBe('<div>2</div>')
  })

  test('rerender for nested component', () => {
    const id = 'child-nested-rerender'
    const Foo = {
      __vapor: true,
      __hmrId: id,
      setup(_ctx: any, { slots }: any) {
        return slots.default()
      },
    }
    createRecord(id, Foo)

    const parentId = 'parent-nested-rerender'
    const Parent = {
      __vapor: true,
      __hmrId: parentId,
      render() {
        return createComponent(
          Foo,
          {},
          {
            default: withVaporCtx(() => {
              return createSlot('default')
            }),
          },
        )
      },
    }

    const appId = 'app-nested-rerender'
    const App = {
      __vapor: true,
      __hmrId: appId,
      render: () =>
        createComponent(
          Parent,
          {},
          {
            default: withVaporCtx(() => {
              return createComponent(
                Foo,
                {},
                {
                  default: () => template('foo')(),
                },
              )
            }),
          },
        ),
    }
    createRecord(parentId, App)

    const root = document.createElement('div')
    define(App).render({}, root)
    expect(root.innerHTML).toBe('foo<!--slot-->')

    rerender(id, () => template('bar')())
    expect(root.innerHTML).toBe('bar')
  })

  test('reload nested components from single update', async () => {
    const innerId = 'nested-reload-inner'
    const outerId = 'nested-reload-outer'

    let Inner = {
      __vapor: true,
      __hmrId: innerId,
      render() {
        return template('<div>foo</div>')()
      },
    }
    let Outer = {
      __vapor: true,
      __hmrId: outerId,
      render() {
        return createComponent(Inner as any)
      },
    }

    createRecord(innerId, Inner)
    createRecord(outerId, Outer)

    const App = {
      __vapor: true,
      render: () => createComponent(Outer),
    }

    const root = document.createElement('div')
    define(App).render({}, root)
    expect(root.innerHTML).toBe('<div>foo</div>')

    Inner = {
      __vapor: true,
      __hmrId: innerId,
      render() {
        return template('<div>bar</div>')()
      },
    }
    Outer = {
      __vapor: true,
      __hmrId: outerId,
      render() {
        return createComponent(Inner as any)
      },
    }

    // trigger reload for both Outer and Inner
    reload(outerId, Outer)
    reload(innerId, Inner)
    await nextTick()

    expect(root.innerHTML).toBe('<div>bar</div>')
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
