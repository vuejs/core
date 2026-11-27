import {
  createApp,
  h,
  nodeOps,
  onUnmounted,
  serializeInner,
} from '@vue/runtime-test'

describe('app unmount errors', () => {
  test('resumes cleanup at the callback that threw', () => {
    const root = nodeOps.createElement('div')
    const app = createApp(() => 'A')
    const error = new Error('cleanup failed')
    const first = vi.fn()
    const failing = vi.fn().mockImplementationOnce(() => {
      throw error
    })
    const last = vi.fn()
    app.onUnmount(first)
    app.onUnmount(failing)
    app.onUnmount(last)
    app.mount(root)

    expect(() => app.unmount()).toThrow(error)
    expect(
      'Unhandled error during execution of app unmount cleanup',
    ).toHaveBeenWarned()
    expect(serializeInner(root)).toBe('A')
    expect(last).not.toHaveBeenCalled()

    app.unmount()
    expect(serializeInner(root)).toBe('')
    expect(first).toHaveBeenCalledOnce()
    expect(failing).toHaveBeenCalledTimes(2)
    expect(last).toHaveBeenCalledOnce()
  })

  test('keeps cleanup consumed when the renderer retries teardown', () => {
    const root = nodeOps.createElement('div')
    const error = new Error('vnode hook failed')
    const onVnodeBeforeUnmount = vi.fn().mockImplementationOnce(() => {
      throw error
    })
    const app = createApp(() => h('div', { onVnodeBeforeUnmount }, 'A'))
    const cleanup = vi.fn()
    app.onUnmount(cleanup)
    app.mount(root)

    expect(() => app.unmount()).toThrow(error)
    expect('Unhandled error during execution of vnode hook').toHaveBeenWarned()
    expect(serializeInner(root)).toBe('<div>A</div>')

    app.unmount()
    expect(serializeInner(root)).toBe('')
    expect(cleanup).toHaveBeenCalledOnce()
  })

  test('leaves the replacement mounted when an unmounted hook threw after teardown', () => {
    const root = nodeOps.createElement('div')
    const error = new Error('unmounted hook failed')
    const app = createApp({
      setup() {
        onUnmounted(() => {
          throw error
        })
        return () => 'A'
      },
    })
    const cleanup = vi.fn()
    app.onUnmount(cleanup)
    app.mount(root)

    expect(() => app.unmount()).toThrow(error)
    expect(
      'Unhandled error during execution of unmounted hook',
    ).toHaveBeenWarned()
    expect(serializeInner(root)).toBe('')

    const replacement = createApp(() => 'B')
    replacement.mount(root)
    app.unmount()
    expect(serializeInner(root)).toBe('B')
    expect(cleanup).toHaveBeenCalledOnce()
    expect('Cannot unmount an app that is not mounted').toHaveBeenWarned()
  })
})
