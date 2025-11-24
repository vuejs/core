import { effectScope, ref } from '@vue/reactivity'
import { type VaporDirective, withVaporDirectives } from '../../src'
import { nextTick, watchEffect } from '@vue/runtime-dom'

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
})
