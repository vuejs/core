import { HMRRuntime } from '../src/hmr'
import '../src/hmr'
import { ComponentOptions, RenderFunction } from '../src/component'
import {
  render,
  nodeOps,
  h,
  serializeInner,
  triggerEvent,
  TestElement,
  nextTick
} from '@vue/runtime-test'
import * as runtimeTest from '@vue/runtime-test'
import { baseCompile } from '@vue/compiler-core'

declare var __VUE_HMR_RUNTIME__: HMRRuntime
const { createRecord, rerender, reload } = __VUE_HMR_RUNTIME__

function compileToFunction(template: string) {
  const { code } = baseCompile(template)
  const render = new Function('Vue', code)(runtimeTest) as RenderFunction
  render.isRuntimeCompiled = true
  return render
}

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
      render: compileToFunction(`<slot/>`)
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      __hmrId: parentId,
      data() {
        return { count: 0 }
      },
      components: { Child },
      render: compileToFunction(
        `<div @click="count++">{{ count }}<Child>{{ count }}</Child></div>`
      )
    }
    createRecord(parentId, Parent)

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<div>0<!---->0<!----></div>`)

    // Perform some state change. This change should be preserved after the
    // re-render!
    triggerEvent(root.children[0] as TestElement, 'click')
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>1<!---->1<!----></div>`)

    // Update text while preserving state
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}!<Child>{{ count }}</Child></div>`
      )
    )
    expect(serializeInner(root)).toBe(`<div>1!<!---->1<!----></div>`)

    // Should force child update on slot content change
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}!<Child>{{ count }}!</Child></div>`
      )
    )
    expect(serializeInner(root)).toBe(`<div>1!<!---->1!<!----></div>`)

    // Should force update element children despite block optimization
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">{{ count }}<span>{{ count }}</span>
        <Child>{{ count }}!</Child>
      </div>`
      )
    )
    expect(serializeInner(root)).toBe(
      `<div>1<span>1</span><!---->1!<!----></div>`
    )

    // Should force update child slot elements
    rerender(
      parentId,
      compileToFunction(
        `<div @click="count++">
        <Child><span>{{ count }}</span></Child>
      </div>`
      )
    )
    expect(serializeInner(root)).toBe(`<div><!----><span>1</span><!----></div>`)
  })

  test('reload', async () => {
    const root = nodeOps.createElement('div')
    const childId = 'test3-child'
    const unmoutSpy = jest.fn()
    const mountSpy = jest.fn()

    const Child: ComponentOptions = {
      __hmrId: childId,
      data() {
        return { count: 0 }
      },
      unmounted: unmoutSpy,
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`)
    }
    createRecord(childId, Child)

    const Parent: ComponentOptions = {
      render: () => h(Child)
    }

    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<div>0</div>`)

    reload(childId, {
      __hmrId: childId,
      data() {
        return { count: 1 }
      },
      mounted: mountSpy,
      render: compileToFunction(`<div @click="count++">{{ count }}</div>`)
    })
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>1</div>`)
    expect(unmoutSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)
  })
})
