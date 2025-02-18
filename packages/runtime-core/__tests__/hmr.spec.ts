import type { HMRRuntime } from '../src/hmr'
import '../src/hmr'
import type { ComponentOptions, InternalRenderFunction } from '../src/component'
import {
  type TestElement,
  h,
  nextTick,
  nodeOps,
  ref,
  render,
  serializeInner,
  triggerEvent,
} from '@vue/runtime-test'
import * as runtimeTest from '@vue/runtime-test'
import { createApp, registerRuntimeCompiler } from '@vue/runtime-test'
import { baseCompile } from '@vue/compiler-core'

declare var __VUE_HMR_RUNTIME__: HMRRuntime
const { createRecord, rerender, reload } = __VUE_HMR_RUNTIME__

registerRuntimeCompiler(compileToFunction)

function compileToFunction(template: string) {
  const { code } = baseCompile(template, { hoistStatic: true, hmr: true })
  const render = new Function('Vue', code)(
    runtimeTest,
  ) as InternalRenderFunction
  render._rc = true // isRuntimeCompiled
  return render
}

const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

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
    const root = nodeOps.createElement('div')
    const parentId = 'test2-parent'
    const childId = 'test2-child'

    const Child: ComponentOptions = {
      __hmrId: childId,
      render: compileToFunction(`<div><slot/></div>`),
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      __hmrId: parentId,
      data() {
        return { count: 0 }
      },
      components: { Child },
      render: compileToFunction(
        `<div @click="count++">{{ count }}<Child>{{ count }}</Child></div>`,
      ),
    }
    createRecord(parentId, Parent)

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<div>0<div>0</div></div>`)

    // Perform some state change. This change should be preserved after the
    // re-render!
    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>1<div>1</div></div>`)

    // // Update text while preserving state
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}!<Child>{{ count }}</Child></div>`,
      ),
    )
    expect(serializeInner(root)).toBe(`<div>1!<div>1</div></div>`)

    // Should force child update on slot content change
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}!<Child>{{ count }}!</Child></div>`,
      ),
    )
    expect(serializeInner(root)).toBe(`<div>1!<div>1!</div></div>`)

    // Should force update element children despite block optimization
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}<span>{{ count }}</span>
        <Child>{{ count }}!</Child>
      </div>`,
      ),
    )
    expect(serializeInner(root)).toBe(`<div>1<span>1</span><div>1!</div></div>`)

    // Should force update child slot elements
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">
        <Child><span>{{ count }}</span></Child>
      </div>`,
      ),
    )
    expect(serializeInner(root)).toBe(`<div><div><span>1</span></div></div>`)
  })

  test('reload', async () => {
    const root = nodeOps.createElement('div')
    const childId = 'test3-child'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()

    const Child: ComponentOptions = {
      __hmrId: childId,
      data() {
        return { count: 0 }
      },
      unmounted: unmountSpy,
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      render: () => h(Child),
    }

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<div>0</div>`)

    reload(childId, {
      __hmrId: childId,
      data() {
        return { count: 1 }
      },
      mounted: mountSpy,
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    })
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>1</div>`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
  })

  // #7042
  test('reload KeepAlive slot', async () => {
    const root = nodeOps.createElement('div')
    const childId = 'test-child-keep-alive'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()
    const activeSpy = vi.fn()
    const deactiveSpy = vi.fn()

    const Child: ComponentOptions = {
      __hmrId: childId,
      data() {
        return { count: 0 }
      },
      unmounted: unmountSpy,
      render: compileToFunction(`<div>{{ count }}</div>`),
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      components: { Child },
      data() {
        return { toggle: true }
      },
      render: compileToFunction(
        `<button @click="toggle = !toggle" />
        <KeepAlive><Child v-if="toggle" /></KeepAlive>`,
      ),
    }

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<button></button><div>0</div>`)

    reload(childId, {
      __hmrId: childId,
      data() {
        return { count: 1 }
      },
      mounted: mountSpy,
      unmounted: unmountSpy,
      activated: activeSpy,
      deactivated: deactiveSpy,
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    await nextTick()
    expect(serializeInner(root)).toBe(`<button></button><div>1</div>`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactiveSpy).toHaveBeenCalledTimes(0)

    // should not unmount when toggling
    triggerEvent(root.children[1] as TestElement, 'click')
    await nextTick()
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactiveSpy).toHaveBeenCalledTimes(1)

    // should not mount when toggling
    triggerEvent(root.children[1] as TestElement, 'click')
    await nextTick()
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(2)
    expect(deactiveSpy).toHaveBeenCalledTimes(1)
  })

  // #7121
  test('reload KeepAlive slot in Transition', async () => {
    const root = nodeOps.createElement('div')
    const childId = 'test-transition-keep-alive-reload'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()
    const activeSpy = vi.fn()
    const deactiveSpy = vi.fn()

    const Child: ComponentOptions = {
      __hmrId: childId,
      data() {
        return { count: 0 }
      },
      unmounted: unmountSpy,
      render: compileToFunction(`<div>{{ count }}</div>`),
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      components: { Child },
      data() {
        return { toggle: true }
      },
      render: compileToFunction(
        `<button @click="toggle = !toggle" />
        <BaseTransition>
          <KeepAlive><Child v-if="toggle" /></KeepAlive>
        </BaseTransition>`,
      ),
    }

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<button></button><div>0</div>`)

    reload(childId, {
      __hmrId: childId,
      data() {
        return { count: 1 }
      },
      mounted: mountSpy,
      unmounted: unmountSpy,
      activated: activeSpy,
      deactivated: deactiveSpy,
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    await nextTick()
    expect(serializeInner(root)).toBe(`<button></button><div>1</div>`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactiveSpy).toHaveBeenCalledTimes(0)

    // should not unmount when toggling
    triggerEvent(root.children[1] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<button></button><!--v-if-->`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactiveSpy).toHaveBeenCalledTimes(1)

    // should not mount when toggling
    triggerEvent(root.children[1] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<button></button><div>1</div>`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(2)
    expect(deactiveSpy).toHaveBeenCalledTimes(1)
  })

  test('reload KeepAlive slot in Transition with out-in', async () => {
    const root = nodeOps.createElement('div')
    const childId = 'test-transition-keep-alive-reload-with-out-in'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()
    const activeSpy = vi.fn()
    const deactiveSpy = vi.fn()

    const Child: ComponentOptions = {
      __hmrId: childId,
      name: 'original',
      data() {
        return { count: 0 }
      },
      unmounted: unmountSpy,
      render: compileToFunction(`<div>{{ count }}</div>`),
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      components: { Child },
      data() {
        return { toggle: true }
      },
      methods: {
        // @ts-expect-error
        onLeave(_, done) {
          setTimeout(done, 0)
        },
      },
      render: compileToFunction(
        `<button @click="toggle = !toggle" />
        <BaseTransition mode="out-in" @leave="onLeave">
          <KeepAlive><Child v-if="toggle" /></KeepAlive>
        </BaseTransition>`,
      ),
    }

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<button></button><div>0</div>`)

    reload(childId, {
      __hmrId: childId,
      name: 'updated',
      data() {
        return { count: 1 }
      },
      mounted: mountSpy,
      unmounted: unmountSpy,
      activated: activeSpy,
      deactivated: deactiveSpy,
      render: compileToFunction(`<div>{{ count }}</div>`),
    })
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
    expect(serializeInner(root)).toBe(`<button></button><div>1</div>`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactiveSpy).toHaveBeenCalledTimes(0)

    // should not unmount when toggling
    triggerEvent(root.children[1] as TestElement, 'click')
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
    expect(serializeInner(root)).toBe(`<button></button><!--v-if-->`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(1)
    expect(deactiveSpy).toHaveBeenCalledTimes(1)

    // should not mount when toggling
    triggerEvent(root.children[1] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<button></button><div>1</div>`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
    expect(activeSpy).toHaveBeenCalledTimes(2)
    expect(deactiveSpy).toHaveBeenCalledTimes(1)
  })

  test('reload class component', async () => {
    const root = nodeOps.createElement('div')
    const childId = 'test4-child'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()

    class Child {
      static __vccOpts: ComponentOptions = {
        __hmrId: childId,
        data() {
          return { count: 0 }
        },
        unmounted: unmountSpy,
        render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
      }
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      render: () => h(Child),
    }

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<div>0</div>`)

    class UpdatedChild {
      static __vccOpts: ComponentOptions = {
        __hmrId: childId,
        data() {
          return { count: 1 }
        },
        mounted: mountSpy,
        render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
      }
    }

    reload(childId, UpdatedChild)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>1</div>`)
    expect(unmountSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
  })

  // #6930
  test('reload: avoid infinite recursion', async () => {
    const root = nodeOps.createElement('div')
    const childId = 'test-child-6930'
    const unmountSpy = vi.fn()
    const mountSpy = vi.fn()

    const Child: ComponentOptions = {
      __hmrId: childId,
      data() {
        return { count: 0 }
      },
      expose: ['count'],
      unmounted: unmountSpy,
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      setup() {
        const com1 = ref()
        const changeRef1 = (value: any) => (com1.value = value)

        const com2 = ref()
        const changeRef2 = (value: any) => (com2.value = value)

        return () => [
          h(Child, { ref: changeRef1 }),
          h(Child, { ref: changeRef2 }),
          com1.value?.count,
        ]
      },
    }

    render(h(Parent), root)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>0</div><div>0</div>0`)

    reload(childId, {
      __hmrId: childId,
      data() {
        return { count: 1 }
      },
      mounted: mountSpy,
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`),
    })
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>1</div><div>1</div>1`)
    expect(unmountSpy).toHaveBeenCalledTimes(2)
    expect(mountSpy).toHaveBeenCalledTimes(2)
  })

  // #1156 - static nodes should retain DOM element reference across updates
  // when HMR is active
  test('static el reference', async () => {
    const root = nodeOps.createElement('div')
    const id = 'test-static-el'

    const template = `<div>
    <div>{{ count }}</div>
    <button @click="count++">++</button>
  </div>`

    const Comp: ComponentOptions = {
      __hmrId: id,
      data() {
        return { count: 0 }
      },
      render: compileToFunction(template),
    }
    createRecord(id, Comp)

    render(h(Comp), root)
    expect(serializeInner(root)).toBe(
      `<div><div>0</div><button>++</button></div>`,
    )

    // 1. click to trigger update
    triggerEvent((root as any).children[0].children[1], 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div><div>1</div><button>++</button></div>`,
    )

    // 2. trigger HMR
    rerender(
      id,
      compileToFunction(template.replace(`<button`, `<button class="foo"`)),
    )
    expect(serializeInner(root)).toBe(
      `<div><div>1</div><button class="foo">++</button></div>`,
    )
  })

  // #1157 - component should force full props update when HMR is active
  test('force update child component w/ static props', () => {
    const root = nodeOps.createElement('div')
    const parentId = 'test-force-props-parent'
    const childId = 'test-force-props-child'

    const Child: ComponentOptions = {
      __hmrId: childId,
      props: {
        msg: String,
      },
      render: compileToFunction(`<div>{{ msg }}</div>`),
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      __hmrId: parentId,
      components: { Child },
      render: compileToFunction(`<Child msg="foo" />`),
    }
    createRecord(parentId, Parent)

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<div>foo</div>`)

    rerender(parentId, compileToFunction(`<Child msg="bar" />`))
    expect(serializeInner(root)).toBe(`<div>bar</div>`)
  })

  // #1305 - component should remove class
  test('remove static class from parent', () => {
    const root = nodeOps.createElement('div')
    const parentId = 'test-force-class-parent'
    const childId = 'test-force-class-child'

    const Child: ComponentOptions = {
      __hmrId: childId,
      render: compileToFunction(`<div>child</div>`),
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      __hmrId: parentId,
      components: { Child },
      render: compileToFunction(`<Child class="test" />`),
    }
    createRecord(parentId, Parent)

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<div class="test">child</div>`)

    rerender(parentId, compileToFunction(`<Child/>`))
    expect(serializeInner(root)).toBe(`<div>child</div>`)
  })

  test('rerender if any parent in the parent chain', () => {
    const root = nodeOps.createElement('div')
    const parent = 'test-force-props-parent-'
    const childId = 'test-force-props-child'

    const numberOfParents = 5

    const Child: ComponentOptions = {
      __hmrId: childId,
      render: compileToFunction(`<div>child</div>`),
    }
    createRecord(childId, Child)

    const components: ComponentOptions[] = []

    for (let i = 0; i < numberOfParents; i++) {
      const parentId = `${parent}${i}`
      const parentComp: ComponentOptions = {
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

      createRecord(parentId, parentComp)
    }

    const last = components[components.length - 1]

    render(h(last), root)
    expect(serializeInner(root)).toBe(`<div>child</div>`)

    rerender(last.__hmrId!, compileToFunction(`<Parent class="test"/>`))
    expect(serializeInner(root)).toBe(`<div class="test">child</div>`)
  })

  // #3302
  test('rerender with Teleport', () => {
    const root = nodeOps.createElement('div')
    const target = nodeOps.createElement('div')
    const parentId = 'parent-teleport'

    const Child: ComponentOptions = {
      data() {
        return {
          // style is used to ensure that the div tag will be tracked by Teleport
          style: {},
          target,
        }
      },
      render: compileToFunction(`
        <teleport :to="target">
          <div :style="style">
            <slot/>
          </div>
        </teleport>
      `),
    }

    const Parent: ComponentOptions = {
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
    createRecord(parentId, Parent)

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(
      `<!--teleport start--><!--teleport end-->`,
    )
    expect(serializeInner(target)).toBe(`<div style={}><div>1</div></div>`)

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
    expect(serializeInner(root)).toBe(
      `<!--teleport start--><!--teleport end-->`,
    )
    expect(serializeInner(target)).toBe(
      `<div style={}><div>1</div><div>2</div></div>`,
    )
  })

  // #4174
  test('with global mixins', async () => {
    const childId = 'hmr-global-mixin'
    const createSpy1 = vi.fn()
    const createSpy2 = vi.fn()

    const Child: ComponentOptions = {
      __hmrId: childId,
      created: createSpy1,
      render() {
        return h('div')
      },
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      render: () => h(Child),
    }

    const app = createApp(Parent)
    app.mixin({})

    const root = nodeOps.createElement('div')
    app.mount(root)
    expect(createSpy1).toHaveBeenCalledTimes(1)
    expect(createSpy2).toHaveBeenCalledTimes(0)

    reload(childId, {
      __hmrId: childId,
      created: createSpy2,
      render() {
        return h('div')
      },
    })
    await nextTick()
    expect(createSpy1).toHaveBeenCalledTimes(1)
    expect(createSpy2).toHaveBeenCalledTimes(1)
  })

  // #4757
  test('rerender for component that has no active instance yet', () => {
    const id = 'no-active-instance-rerender'
    const Foo: ComponentOptions = {
      __hmrId: id,
      render: () => 'foo',
    }

    createRecord(id, Foo)
    rerender(id, () => 'bar')

    const root = nodeOps.createElement('div')
    render(h(Foo), root)
    expect(serializeInner(root)).toBe('bar')
  })

  test('reload for component that has no active instance yet', () => {
    const id = 'no-active-instance-reload'
    const Foo: ComponentOptions = {
      __hmrId: id,
      render: () => 'foo',
    }

    createRecord(id, Foo)
    reload(id, {
      __hmrId: id,
      render: () => 'bar',
    })

    const root = nodeOps.createElement('div')
    render(h(Foo), root)
    expect(serializeInner(root)).toBe('bar')
  })

  // #7155 - force HMR on slots content update
  test('force update slot content change', () => {
    const root = nodeOps.createElement('div')
    const parentId = 'test-force-computed-parent'
    const childId = 'test-force-computed-child'

    const Child: ComponentOptions = {
      __hmrId: childId,
      computed: {
        slotContent() {
          return this.$slots.default?.()
        },
      },
      render: compileToFunction(`<component :is="() => slotContent" />`),
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      __hmrId: parentId,
      components: { Child },
      render: compileToFunction(`<Child>1</Child>`),
    }
    createRecord(parentId, Parent)

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`1`)

    rerender(parentId, compileToFunction(`<Child>2</Child>`))
    expect(serializeInner(root)).toBe(`2`)
  })

  // #6978, #7138, #7114
  test('hoisted children array inside v-for', () => {
    const root = nodeOps.createElement('div')
    const appId = 'test-app-id'
    const App: ComponentOptions = {
      __hmrId: appId,
      render: compileToFunction(
        `<div v-for="item of 2">
          <div>1</div>
        </div>
        <p>2</p>
        <p>3</p>`,
      ),
    }
    createRecord(appId, App)

    render(h(App), root)
    expect(serializeInner(root)).toBe(
      `<div><div>1</div></div><div><div>1</div></div><p>2</p><p>3</p>`,
    )

    // move the <p>3</p> into the <div>1</div>
    rerender(
      appId,
      compileToFunction(
        `<div v-for="item of 2">
          <div>1<p>3</p></div>
        </div>
        <p>2</p>`,
      ),
    )
    expect(serializeInner(root)).toBe(
      `<div><div>1<p>3</p></div></div><div><div>1<p>3</p></div></div><p>2</p>`,
    )
  })

  // #11248
  test('reload async component with multiple instances', async () => {
    const root = nodeOps.createElement('div')
    const childId = 'test-child-id'
    const Child: ComponentOptions = {
      __hmrId: childId,
      data() {
        return { count: 0 }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    }
    const Comp = runtimeTest.defineAsyncComponent(() => Promise.resolve(Child))
    const appId = 'test-app-id'
    const App: ComponentOptions = {
      __hmrId: appId,
      render: () => [h(Comp), h(Comp)],
    }
    createRecord(appId, App)

    render(h(App), root)

    await timeout()

    expect(serializeInner(root)).toBe(`<div>0</div><div>0</div>`)

    // change count to 1
    reload(childId, {
      __hmrId: childId,
      data() {
        return { count: 1 }
      },
      render: compileToFunction(`<div>{{ count }}</div>`),
    })

    await timeout()

    expect(serializeInner(root)).toBe(`<div>1</div><div>1</div>`)
  })

  test('reload async child wrapped in Suspense + KeepAlive', async () => {
    const id = 'async-child-reload'
    const AsyncChild: ComponentOptions = {
      __hmrId: id,
      async setup() {
        await nextTick()
        return () => 'foo'
      },
    }
    createRecord(id, AsyncChild)

    const appId = 'test-app-id'
    const App: ComponentOptions = {
      __hmrId: appId,
      components: { AsyncChild },
      render: compileToFunction(`
        <div>
        <Suspense>
          <KeepAlive>
            <AsyncChild />
          </KeepAlive>
        </Suspense>
      </div>
      `),
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe('<div><!----></div>')
    await timeout()
    expect(serializeInner(root)).toBe('<div>foo</div>')

    reload(id, {
      __hmrId: id,
      async setup() {
        await nextTick()
        return () => 'bar'
      },
    })
    await timeout()
    expect(serializeInner(root)).toBe('<div>bar</div>')
  })
})
