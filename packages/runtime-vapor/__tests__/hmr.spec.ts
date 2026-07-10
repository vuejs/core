import {
  type HMRRuntime,
  computed,
  createApp,
  currentInstance,
  h,
  inject,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  popWarningContext,
  provide,
  ref,
  setCurrentInstance,
  toDisplayString,
  warn,
  watchEffect,
} from '@vue/runtime-dom'
import { compileToVaporRender as compileToFunction, makeRender } from './_utils'
import {
  createComponent,
  createSlot,
  createTemplateRefSetter,
  createVaporApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  delegateEvents,
  renderEffect,
  setText,
  template,
  vaporInteropPlugin,
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
    expect(root.innerHTML).toBe(`<div>0<div>0</div></div>`)

    // Perform some state change. This change should be preserved after the
    // re-render!
    // triggerEvent(root.children[0] as TestElement, 'click')
    triggerEvent('click', root.children[0])
    await nextTick()
    expect(root.innerHTML).toBe(`<div>1<div>1</div></div>`)

    // Update text while preserving state
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}!<Child>{{ count }}</Child></div>`,
      ),
    )
    expect(root.innerHTML).toBe(`<div>1!<div>1</div></div>`)

    // Should force child update on slot content change
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}!<Child>{{ count }}!</Child></div>`,
      ),
    )
    expect(root.innerHTML).toBe(`<div>1!<div>1!</div></div>`)

    // Should force update element children despite block optimization
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}<span>{{ count }}</span>
      <Child>{{ count }}!</Child>
    </div>`,
      ),
    )
    expect(root.innerHTML).toBe(`<div>1<span>1</span><div>1!</div></div>`)

    // Should force update child slot elements
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">
      <Child><span>{{ count }}</span></Child>
    </div>`,
      ),
    )
    expect(root.innerHTML).toBe(`<div><div><span>1</span></div></div>`)
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

  test('reload child should preserve parent setup effects', async () => {
    const root = document.createElement('div')
    const childId = 'test-reload-child-preserve-parent-effects'
    const parentCount = ref(0)
    const spy = vi.fn()

    const Child = defineVaporComponent({
      __hmrId: childId,
      render: () => template('<div>old</div>')(),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      setup() {
        watchEffect(() => spy(parentCount.value))
      },
      render: () => createComponent(Child),
    })

    createVaporApp(Parent).mount(root)
    expect(root.innerHTML).toBe(`<div>old</div>`)
    expect(spy).toHaveBeenLastCalledWith(0)

    reload(childId, {
      __vapor: true,
      __hmrId: childId,
      render: () => template('<div>new</div>')(),
    })
    await nextTick()
    expect(root.innerHTML).toBe(`<div>new</div>`)

    parentCount.value++
    await nextTick()
    expect(spy).toHaveBeenLastCalledWith(1)
  })

  test('reload root vapor component should preserve appContext provide/inject', async () => {
    const root = document.createElement('div')
    const appId = 'test-root-reload-app-context'

    const Child = defineVaporComponent({
      setup() {
        const msg = inject('msg')
        return { msg }
      },
      render: compileToFunction(`<div>{{ msg }}</div>`),
    })

    const App = defineVaporComponent({
      __hmrId: appId,
      render: () => createComponent(Child),
    })
    createRecord(appId, App as any)

    const app = createVaporApp(App)
    app.provide('msg', 'app-injected')
    app.mount(root)
    expect(root.innerHTML).toBe(`<div>app-injected</div>`)

    reload(appId, {
      __vapor: true,
      __hmrId: appId,
      render: () => createComponent(Child),
    })

    await nextTick()
    expect(root.innerHTML).toBe(`<div>app-injected</div>`)
  })

  test('reload root vapor component should update app instance for unmount', async () => {
    const root = document.createElement('div')
    const appId = 'test-root-reload-app-unmount'
    const oldUnmountSpy = vi.fn()
    const newUnmountSpy = vi.fn()

    const App = defineVaporComponent({
      __hmrId: appId,
      setup() {
        onUnmounted(oldUnmountSpy)
      },
      render: () => template(`<div>old</div>`)(),
    })
    createRecord(appId, App as any)

    const app = createVaporApp(App)
    app.mount(root)
    expect(root.innerHTML).toBe(`<div>old</div>`)

    reload(appId, {
      __vapor: true,
      __hmrId: appId,
      setup() {
        onUnmounted(newUnmountSpy)
      },
      render: () => template(`<div>new</div>`)(),
    })

    await nextTick()
    expect(root.innerHTML).toBe(`<div>new</div>`)
    expect(oldUnmountSpy).toHaveBeenCalledTimes(1)

    app.unmount()
    await nextTick()
    expect(root.innerHTML).toBe(``)
    expect(newUnmountSpy).toHaveBeenCalledTimes(1)
  })

  test('failed rerender restores current instance and warning context', () => {
    const root = document.createElement('div')
    const id = 'test-rerender-restore-context'
    const warnHandler = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const Comp = defineVaporComponent({
      __hmrId: id,
      render: () => template('ok')(),
    })
    createRecord(id, Comp as any)

    const app = createVaporApp(Comp)
    app.config.warnHandler = warnHandler
    app.mount(root)
    expect(currentInstance).toBe(null)

    rerender(id, () => {
      throw new Error('hmr rerender error')
    })
    warnHandler.mockClear()

    const leakedInstance = currentInstance
    setCurrentInstance(null, undefined)
    warn('after failed hmr')
    popWarningContext()
    errorSpy.mockRestore()

    expect(
      '[HMR] Something went wrong during Vue component hot-reload.',
    ).toHaveBeenWarned()
    expect('[Vue warn]: after failed hmr').toHaveBeenWarned()
    expect(leakedInstance).toBe(null)
    expect(warnHandler).not.toHaveBeenCalled()
  })

  test('failed reload restores current instance', () => {
    const root = document.createElement('div')
    const childId = 'test-reload-restore-context-child'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const Child = defineVaporComponent({
      __hmrId: childId,
      render: () => template('old')(),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      render: () => createComponent(Child),
    })

    createVaporApp(Parent).mount(root)
    expect(currentInstance).toBe(null)

    reload(childId, {
      __vapor: true,
      __hmrId: childId,
      setup() {
        throw new Error('hmr reload error')
      },
      render: () => template('new')(),
    })

    const leakedInstance = currentInstance
    setCurrentInstance(null, undefined)
    errorSpy.mockRestore()

    expect(
      '[Vue warn]: Unhandled error during execution of setup function',
    ).toHaveBeenWarned()
    expect(
      '[Vue warn]: Unhandled error during execution of render function',
    ).toHaveBeenWarned()
    expect(
      '[HMR] Something went wrong during Vue component hot-reload.',
    ).toHaveBeenWarned()
    expect(leakedInstance).toBe(null)
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

  test('reload deactivated KeepAlive child', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const childId = 'test-child-keep-alive-deactivated'
    const oldUnmountSpy = vi.fn()
    const oldActiveSpy = vi.fn()
    const oldDeactivatedSpy = vi.fn()
    const newUnmountSpy = vi.fn()
    const newMountSpy = vi.fn()
    const newActiveSpy = vi.fn()
    const newDeactivatedSpy = vi.fn()

    const Child = defineVaporComponent({
      __hmrId: childId,
      setup() {
        onUnmounted(oldUnmountSpy)
        onActivated(oldActiveSpy)
        onDeactivated(oldDeactivatedSpy)
        const count = ref(0)
        return { count }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    createRecord(childId, Child as any)

    const Parent = defineVaporComponent({
      __hmrId: 'parentId-keep-alive-deactivated',
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
    expect(oldActiveSpy).toHaveBeenCalledTimes(1)
    expect(oldDeactivatedSpy).toHaveBeenCalledTimes(0)
    expect(oldUnmountSpy).toHaveBeenCalledTimes(0)

    // deactivate and move child into KeepAlive cache
    triggerEvent('click', root.children[0] as Element)
    await nextTick()
    expect(root.innerHTML).toBe(`<button></button><!--if-->`)
    expect(oldDeactivatedSpy).toHaveBeenCalledTimes(1)
    expect(oldUnmountSpy).toHaveBeenCalledTimes(0)

    // reload while child is cached but inactive
    reload(childId, {
      __hmrId: childId,
      __vapor: true,
      setup() {
        onMounted(newMountSpy)
        onUnmounted(newUnmountSpy)
        onActivated(newActiveSpy)
        onDeactivated(newDeactivatedSpy)
        const count = ref(1)
        return { count }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    await nextTick()
    expect(root.innerHTML).toBe(`<button></button><!--if-->`)
    // old cached instance should be unmounted during KeepAlive HMR rerender
    expect(oldUnmountSpy).toHaveBeenCalledTimes(1)

    // re-activate should render the new component instance
    triggerEvent('click', root.children[0] as Element)
    await nextTick()
    expect(root.innerHTML).toBe(`<button></button><div>1</div><!--if-->`)
    expect(newMountSpy).toHaveBeenCalledTimes(1)
    expect(newActiveSpy).toHaveBeenCalledTimes(1)
    expect(newDeactivatedSpy).toHaveBeenCalledTimes(0)

    // subsequent toggles should use KeepAlive cache for the new instance
    triggerEvent('click', root.children[0] as Element)
    await nextTick()
    expect(root.innerHTML).toBe(`<button></button><!--if-->`)
    expect(newMountSpy).toHaveBeenCalledTimes(1)
    expect(newActiveSpy).toHaveBeenCalledTimes(1)
    expect(newDeactivatedSpy).toHaveBeenCalledTimes(1)

    triggerEvent('click', root.children[0] as Element)
    await nextTick()
    expect(root.innerHTML).toBe(`<button></button><div>1</div><!--if-->`)
    expect(newMountSpy).toHaveBeenCalledTimes(1)
    expect(newActiveSpy).toHaveBeenCalledTimes(2)
    expect(newDeactivatedSpy).toHaveBeenCalledTimes(1)
    expect(newUnmountSpy).toHaveBeenCalledTimes(0)
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
        function onLeave(_: any, done: Function) {
          setTimeout(done, 0)
        }
        return { toggle, onLeave }
      },
      render: compileToFunction(
        `<button @click="toggle = !toggle" />
        <Transition @leave="onLeave">
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
    await new Promise(r => setTimeout(r, 0))
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

  test('reload child through parent rerender', async () => {
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
      setup(_, { expose }) {
        onMounted(mountSpy)
        const count = ref(1)
        expose({
          count,
        })
        return { count }
      },
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    })
    await nextTick()
    await nextTick()
    expect(root.innerHTML).toBe(`<div>1</div><div>1</div>1`)
    expect(unmountSpy).toHaveBeenCalledTimes(2)
    expect(mountSpy).toHaveBeenCalledTimes(2)
  })

  test('reload multiple children under same vapor parent should rerender parent once', async () => {
    const root = document.createElement('div')
    const childId = 'test-child-reload-same-vapor-parent'

    const Child = defineVaporComponent({
      __hmrId: childId,
      render: () => template('<div>old</div>')(),
    })
    createRecord(childId, Child as any)

    let parentRenderCount = 0
    const Parent = defineVaporComponent({
      render() {
        parentRenderCount++
        return [createComponent(Child), createComponent(Child)]
      },
    })

    createVaporApp(Parent).mount(root)
    expect(root.innerHTML).toBe(`<div>old</div><div>old</div>`)
    expect(parentRenderCount).toBe(1)

    reload(childId, {
      __vapor: true,
      __hmrId: childId,
      render: () => template('<div>new</div>')(),
    })
    await nextTick()

    expect(root.innerHTML).toBe(`<div>new</div><div>new</div>`)
    expect(parentRenderCount).toBe(2)
  })

  test('reload vapor child under dirty ancestor should not rerender stale owner', async () => {
    const root = document.createElement('div')
    const id = 'test-child-reload-dirty-ancestor'

    let Child: any
    const Wrapper = defineVaporComponent({
      render() {
        return createComponent(Child, { nested: () => true })
      },
    })

    Child = defineVaporComponent({
      __hmrId: id,
      props: ['nested'],
      setup(props: any) {
        return { nested: props.nested }
      },
      render: compileToFunction(
        `<div>old {{ nested ? 'nested' : 'root' }}</div><Wrapper v-if="!nested" />`,
      ),
    })
    Child.components = { Wrapper }
    createRecord(id, Child)

    createVaporApp(Child, { nested: () => false }).mount(root)
    expect(root.textContent).toBe(`old rootold nested`)

    const NewChild: any = {
      __vapor: true,
      __hmrId: id,
      props: ['nested'],
      setup(props: any) {
        return { nested: props.nested }
      },
      render: compileToFunction(
        `<div>new {{ nested ? 'nested' : 'root' }}</div><Wrapper v-if="!nested" />`,
      ),
    }
    NewChild.components = { Wrapper }
    reload(id, NewChild)
    await nextTick()

    expect(root.textContent).toBe(`new rootnew nested`)
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
    expect(target.innerHTML).toBe(`<div><div>1</div></div>`)

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
    expect(target.innerHTML).toBe(`<div><div>1</div><div>2</div></div>`)
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
            default: () => {
              return createSlot('default')
            },
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
            default: () => {
              return createComponent(
                Foo,
                {},
                {
                  default: () => template('foo')(),
                },
              )
            },
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

  test('child reload in dynamic branch should not break subsequent parent reload', async () => {
    const root = document.createElement('div')
    const childId = 'test-dynamic-child-reload'
    const parentId = 'test-dynamic-parent-reload'

    const Child = defineVaporComponent({
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
        const ok = ref(true)
        return { ok }
      },
      render: compileToFunction(`<Child v-if="ok" />`),
    }).create()
    createRecord(parentId, Parent as any)

    mount(root)
    expect(root.innerHTML).toBe(`<div>child</div><!--if-->`)

    reload(childId, {
      __vapor: true,
      __hmrId: childId,
      setup() {
        const msg = ref('child changed')
        return { msg }
      },
      render: compileToFunction(`<div>{{ msg }}</div>`),
    })
    expect(root.innerHTML).toBe(`<div>child changed</div><!--if-->`)

    reload(parentId, {
      __vapor: true,
      __hmrId: parentId,
      components: { Child },
      setup() {
        const ok = ref(true)
        return { ok }
      },
      render: compileToFunction(`<Child v-if="ok" />`),
    })

    await nextTick()
    expect(root.innerHTML).toBe(`<div>child changed</div><!--if-->`)
  })

  test('child reload with multiple instances in dynamic branch should keep parent reload stable', async () => {
    const root = document.createElement('div')
    const childId = 'test-dynamic-multi-child-reload'
    const parentId = 'test-dynamic-multi-parent-reload'

    const Child = defineVaporComponent({
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
        const ok = ref(true)
        return { ok }
      },
      render: compileToFunction(
        `<template v-if="ok"><Child/><Child/></template>`,
      ),
    }).create()
    createRecord(parentId, Parent as any)

    mount(root)
    expect(root.textContent).toBe(`childchild`)

    reload(childId, {
      __vapor: true,
      __hmrId: childId,
      setup() {
        const msg = ref('child changed')
        return { msg }
      },
      render: compileToFunction(`<div>{{ msg }}</div>`),
    })
    expect(root.textContent).toBe(`child changedchild changed`)

    reload(parentId, {
      __vapor: true,
      __hmrId: parentId,
      components: { Child },
      setup() {
        const ok = ref(true)
        return { ok }
      },
      render: compileToFunction(
        `<template v-if="ok"><Child/><Child/></template>`,
      ),
    })

    await nextTick()
    expect(root.textContent).toBe(`child changedchild changed`)
  })

  test('child reload in teleport dynamic branch should not break subsequent parent reload', async () => {
    const root = document.createElement('div')
    const target = document.createElement('div')
    document.body.appendChild(root)
    document.body.appendChild(target)
    const childId = 'test-teleport-dynamic-child-reload'
    const parentId = 'test-teleport-dynamic-parent-reload'

    const Child = defineVaporComponent({
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
        const ok = ref(true)
        return { ok, target }
      },
      render: compileToFunction(
        `<teleport :to="target"><template v-if="ok"><Child/><span>sibling</span></template></teleport>`,
      ),
    }).create()
    createRecord(parentId, Parent as any)

    mount(root)
    expect(target.textContent).toBe(`childsibling`)

    reload(childId, {
      __vapor: true,
      __hmrId: childId,
      setup() {
        const msg = ref('child changed')
        return { msg }
      },
      render: compileToFunction(`<div>{{ msg }}</div>`),
    })
    expect(target.textContent).toBe(`child changedsibling`)

    reload(parentId, {
      __vapor: true,
      __hmrId: parentId,
      components: { Child },
      setup() {
        const ok = ref(true)
        return { ok, target }
      },
      render: compileToFunction(
        `<teleport :to="target"><template v-if="ok"><Child/><span>sibling</span></template></teleport>`,
      ),
    })

    await nextTick()
    expect(target.textContent).toBe(`child changedsibling`)
  })

  // Vapor router-view has no render function (setup-only).
  // When HMR rerender is triggered, the setup function is re-executed.
  // Ensure provide() warning is suppressed.
  test('rerender setup-only component', async () => {
    const childId = 'test-child-reload-01'
    const Child = defineVaporComponent({
      __hmrId: childId,
      render: compileToFunction(`<div>foo</div>`),
    })
    createRecord(childId, Child as any)

    // without a render function
    const Parent = defineVaporComponent({
      setup() {
        provide('foo', 'bar')
        return createComponent(Child)
      },
    })

    const { html } = define({
      setup() {
        return createComponent(Parent)
      },
    }).render()

    expect(html()).toBe('<div>foo</div>')

    // will trigger parent rerender
    reload(childId, {
      __hmrId: childId,
      render: compileToFunction(`<div>bar</div>`),
    })

    await nextTick()
    expect(html()).toBe('<div>bar</div>')
    expect('provide() can only be used inside setup()').not.toHaveBeenWarned()
  })

  describe('switch vapor/vdom modes', () => {
    test('reload vapor child under vdom parent should rerender parent', async () => {
      const id = 'vapor-child-under-vdom-parent'
      const Child = {
        __vapor: true,
        __hmrId: id,
        render() {
          return template('<div>foo</div>')()
        },
      }
      createRecord(id, Child)

      let parentRenderCount = 0
      const Parent = {
        render() {
          parentRenderCount++
          return h(Child as any)
        },
      }
      const root = document.createElement('div')
      const app = createApp(Parent)
      app.use(vaporInteropPlugin)
      app.mount(root)
      expect(root.innerHTML).toBe('<div>foo</div>')
      expect(parentRenderCount).toBe(1)

      reload(id, {
        __vapor: true,
        __hmrId: id,
        render() {
          return template('<div>bar</div>')()
        },
      })

      await nextTick()
      expect(root.innerHTML).toBe('<div>bar</div>')
      expect(parentRenderCount).toBe(2)
    })

    test('reload multiple vapor children under same vdom parent should rerender parent once', async () => {
      const id = 'multiple-vapor-children-under-vdom-parent'
      const Child = {
        __vapor: true,
        __hmrId: id,
        render() {
          return template('<div>foo</div>')()
        },
      }
      createRecord(id, Child)

      let parentRenderCount = 0
      const Parent = {
        render() {
          parentRenderCount++
          return [h(Child as any), h(Child as any)]
        },
      }
      const root = document.createElement('div')
      const app = createApp(Parent)
      app.use(vaporInteropPlugin)
      app.mount(root)
      expect(root.innerHTML).toBe('<div>foo</div><div>foo</div>')
      expect(parentRenderCount).toBe(1)

      reload(id, {
        __vapor: true,
        __hmrId: id,
        render() {
          return template('<div>bar</div>')()
        },
      })

      await nextTick()
      expect(root.innerHTML).toBe('<div>bar</div><div>bar</div>')
      expect(parentRenderCount).toBe(2)
    })

    test('vapor -> vdom', async () => {
      const id = 'vapor-to-vdom'
      const Comp = {
        __vapor: true,
        __hmrId: id,
        render() {
          return template('<div>foo</div>')()
        },
      }
      createRecord(id, Comp)

      const App = {
        render() {
          return h(Comp as any)
        },
      }
      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)
      expect(root.innerHTML).toBe('<div>foo</div>')

      // switch to vdom
      reload(id, {
        __hmrId: id,
        render() {
          return h('div', 'bar')
        },
      })

      await nextTick()
      expect(root.innerHTML).toBe('<div>bar</div>')
    })

    test('vdom -> vapor', async () => {
      const id = 'vdom-to-vapor'
      const Comp = {
        __hmrId: id,
        render() {
          return h('div', 'foo')
        },
      }
      createRecord(id, Comp)

      const App = {
        render() {
          return h(Comp)
        },
      }
      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin)
      app.mount(root)
      expect(root.innerHTML).toBe('<div>foo</div>')

      // switch to vapor
      reload(id, {
        __vapor: true,
        __hmrId: id,
        render() {
          return template('<div>bar</div>')()
        },
      })

      await nextTick()
      expect(root.innerHTML).toBe('<div>bar</div>')
    })
  })
})
