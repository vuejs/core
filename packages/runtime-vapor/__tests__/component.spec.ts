import { nextTick, ref, watchEffect } from '@vue/runtime-dom'
import {
  createComponent,
  createIf,
  renderEffect,
  setText,
  template,
} from '../src'
import { makeRender } from './_utils'
import type { VaporComponentInstance } from '../src/component'

const define = makeRender()

// TODO port tests from rendererComponent.spec.ts

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

  it.todo('should create an Component with props', () => {})

  it.todo('should create an Component with direct text children', () => {})

  it.todo('should update an Component tag which is already mounted', () => {})

  it.todo(
    'should not update Component if only changed props are declared emit listeners',
    () => {},
  )

  it.todo(
    'component child synchronously updating parent state should trigger parent re-render',
    async () => {},
  )

  it.todo('instance.$el should be exposed to watch options', async () => {})

  it.todo(
    'component child updating parent state in pre-flush should trigger parent re-render',
    async () => {},
  )

  it.todo(
    'child only updates once when triggered in multiple ways',
    async () => {},
  )

  it.todo(
    `an earlier update doesn't lead to excessive subsequent updates`,
    async () => {},
  )

  it.todo(
    'should pause tracking deps when initializing legacy options',
    async () => {},
  )

  it.todo(
    'child component props update should not lead to double update',
    async () => {},
  )

  it.todo('should warn accessing `this` in a <script setup> template', () => {})

  it('unmountComponent', async () => {
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
})
