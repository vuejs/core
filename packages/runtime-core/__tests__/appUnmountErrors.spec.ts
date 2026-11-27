import {
  createApp,
  nodeOps,
  onUnmounted,
  serializeInner,
} from '@vue/runtime-test'

describe('app unmount errors', () => {
  test('can retry when app cleanup throws before the root is removed', () => {
    const root = nodeOps.createElement('div')
    const app = createApp(() => 'A')
    const error = new Error('cleanup failed')
    app.onUnmount(
      vi.fn().mockImplementationOnce(() => {
        throw error
      }),
    )
    app.mount(root)

    expect(() => app.unmount()).toThrow(error)
    expect(
      'Unhandled error during execution of app unmount cleanup',
    ).toHaveBeenWarned()
    expect(serializeInner(root)).toBe('A')

    app.unmount()
    expect(serializeInner(root)).toBe('')
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
