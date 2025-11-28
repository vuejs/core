import { effectScope, ref } from '@vue/reactivity'
import {
  type VaporDirective,
  createComponent,
  defineVaporComponent,
  template,
  withVaporDirectives,
} from '../../src'
import { nextTick, watchEffect } from '@vue/runtime-dom'
import type { Mock } from 'vitest'

describe('custom directive', () => {
  it('should work', async () => {
    const teardown = vi.fn()
    const dir: VaporDirective = vi.fn((el, source) => {
      watchEffect(() => {
        el.textContent = source()
      })
      return teardown
    })
    const scope = effectScope()
    const el = document.createElement('div')
    const n = ref(1)
    const source = () => n.value
    const modifiers = { mod: true }
    scope.run(() => {
      withVaporDirectives(el, [[dir, source, undefined, modifiers]])
    })
    expect(dir).toHaveBeenCalledWith(el, source, undefined, modifiers)
    expect(teardown).not.toHaveBeenCalled()

    expect(el.textContent).toBe('1')

    n.value = 2
    await nextTick()
    expect(el.textContent).toBe('2')

    scope.stop()
    expect(teardown).toHaveBeenCalled()

    n.value = 3
    await nextTick()
    // should be stopped and not update
    expect(el.textContent).toBe('2')
  })

  it('should work on single root component', async () => {
    const teardown = vi.fn()
    const dir: VaporDirective = vi.fn((el, source) => {
      watchEffect(() => {
        el.textContent = source()
      })
      return teardown
    })
    const scope = effectScope()
    const n = ref(1)
    const source = () => n.value

    // Child component with single root
    const Child = defineVaporComponent({
      render() {
        return template('<div></div>', true)()
      },
    })

    const root = document.createElement('div')

    scope.run(() => {
      const instance = createComponent(Child)
      withVaporDirectives(instance, [[dir, source]])
      root.appendChild(instance.block as Node)
    })

    // Should resolve to the div element inside Child
    expect(dir).toHaveBeenCalled()
    const el = (dir as unknown as Mock).mock.calls[0][0]
    expect(el).toBeInstanceOf(HTMLDivElement)
    expect(el.textContent).toBe('1')

    n.value = 2
    await nextTick()
    expect(el.textContent).toBe('2')

    scope.stop()
    expect(teardown).toHaveBeenCalled()
  })

  it('should warn on multi-root component', () => {
    const dir: VaporDirective = vi.fn()
    const scope = effectScope()

    // Child component with multiple roots
    const Child = defineVaporComponent({
      render() {
        return [template('<div></div>')(), template('<span></span>')()]
      },
    })

    scope.run(() => {
      const instance = createComponent(Child)
      withVaporDirectives(instance, [[dir]])
    })

    expect(dir).not.toHaveBeenCalled()
    expect(
      'Runtime directive used on component with non-element root node',
    ).toHaveBeenWarned()
  })
})
