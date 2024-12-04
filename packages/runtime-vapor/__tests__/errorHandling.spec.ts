import type { Component } from '../src/component'
import { type RefEl, setRef } from '../src/dom/templateRef'
import { onErrorCaptured, onMounted } from '../src/apiLifecycle'
import { createComponent } from '../src/apiCreateComponent'
import { makeRender } from './_utils'
import { template } from '../src/dom/template'
import { watch, watchEffect } from '../src/apiWatch'
import { nextTick } from '../src/scheduler'
import { ref } from '@vue/reactivity'

const define = makeRender()

describe('error handling', () => {
  test('propagation', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp: Component = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'root')
          return false
        })

        return createComponent(Child)
      },
    }

    const Child: Component = {
      name: 'Child',
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'child')
        })
        return createComponent(GrandChild)
      },
    }

    const GrandChild: Component = {
      setup() {
        onMounted(() => {
          throw err
        })
      },
    }

    define(Comp).render()
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook', 'root')
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook', 'child')
  })

  test('propagation stoppage', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'root')
          return false
        })
        return createComponent(Child)
      },
    }

    const Child = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'child')
          return false
        })
        return createComponent(GrandChild)
      },
    }

    const GrandChild = {
      setup() {
        onMounted(() => {
          throw err
        })
      },
    }

    define(Comp).render()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook', 'child')
  })

  test('async error handling', async () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child = {
      setup() {
        onMounted(async () => {
          throw err
        })
      },
    }

    define(Comp).render()
    expect(fn).not.toHaveBeenCalled()
    await new Promise(r => setTimeout(r))
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook')
  })

  test('error thrown in onErrorCaptured', () => {
    const err = new Error('foo')
    const err2 = new Error('bar')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child = {
      setup() {
        onErrorCaptured(() => {
          throw err2
        })
        return createComponent(GrandChild)
      },
    }

    const GrandChild = {
      setup() {
        onMounted(() => {
          throw err
        })
      },
    }

    define(Comp).render()
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook')
    expect(fn).toHaveBeenCalledWith(err2, 'errorCaptured hook')
  })

  test('setup function', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child = {
      setup() {
        throw err
      },
    }

    define(Comp).render()
    expect(fn).toHaveBeenCalledWith(err, 'setup function')
  })

  test('in render function', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child = {
      render() {
        throw err
      },
    }

    define(Comp).render()
    expect(fn).toHaveBeenCalledWith(err, 'render function')
  })

  test('in function ref', () => {
    const err = new Error('foo')
    const ref = () => {
      throw err
    }
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child = {
      render() {
        const el = template('<div>')()
        setRef(el as RefEl, ref)
        return el
      },
    }

    define(Comp).render()
    expect(fn).toHaveBeenCalledWith(err, 'ref function')
  })

  test('in effect', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child = {
      setup() {
        watchEffect(() => {
          throw err
        })
      },
    }

    define(Comp).render()
    expect(fn).toHaveBeenCalledWith(err, 'watcher callback')
  })

  test('in watch getter', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child = {
      setup() {
        watch(
          () => {
            throw err
          },
          () => {},
        )
      },
    }

    define(Comp).render()
    expect(fn).toHaveBeenCalledWith(err, 'watcher getter')
  })

  test('in watch callback', async () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const count = ref(0)
    const Child = {
      setup() {
        watch(
          () => count.value,
          () => {
            throw err
          },
        )
      },
    }

    define(Comp).render()

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledWith(err, 'watcher callback')
  })

  test('in effect cleanup', async () => {
    const err = new Error('foo')
    const count = ref(0)
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child = {
      setup() {
        watchEffect(onCleanup => {
          count.value
          onCleanup(() => {
            throw err
          })
        })
      },
    }

    define(Comp).render()

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledWith(err, 'watcher cleanup function')
  })

  test('in component event handler via emit', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child, {
          onFoo: () => {
            throw err
          },
        })
      },
    }

    const Child = {
      setup(props: any, { emit }: any) {
        emit('foo')
      },
    }

    define(Comp).render()
    expect(fn).toHaveBeenCalledWith(err, 'setup function')
  })

  test.todo('in component event handler via emit (async)', async () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child, {
          async onFoo() {
            throw err
          },
        })
      },
    }

    const Child = {
      props: ['onFoo'],
      setup(props: any, { emit }: any) {
        emit('foo')
      },
    }

    define(Comp).render()
    await nextTick()
    expect(fn).toHaveBeenCalledWith(err, 'setup function')
  })

  test.todo('in component event handler via emit (async + array)', async () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const res: Promise<any>[] = []
    const createAsyncHandler = (p: Promise<any>) => () => {
      res.push(p)
      return p
    }

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child, [
          {
            onFoo: () => {
              createAsyncHandler(Promise.reject(err))
              createAsyncHandler(Promise.resolve(1))
            },
          },
        ])
      },
    }

    const Child = {
      setup(props: any, { emit }: any) {
        emit('foo')
      },
    }

    define(Comp).render()

    try {
      await Promise.all(res)
    } catch (e: any) {
      expect(e).toBe(err)
    }
    expect(fn).toHaveBeenCalledWith(err, 'component event handler')
  })

  it('should warn unhandled', () => {
    const groupCollapsed = vi.spyOn(console, 'groupCollapsed')
    groupCollapsed.mockImplementation(() => {})
    const log = vi.spyOn(console, 'log')
    log.mockImplementation(() => {})

    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
        })
        return createComponent(Child)
      },
    }

    const Child = {
      setup() {
        throw err
      },
    }

    let caughtError
    try {
      define(Comp).render()
    } catch (caught) {
      caughtError = caught
    }
    expect(fn).toHaveBeenCalledWith(err, 'setup function')
    expect(
      `Unhandled error during execution of setup function`,
    ).toHaveBeenWarned()
    expect(caughtError).toBe(err)

    groupCollapsed.mockRestore()
    log.mockRestore()
  })

  //# 3127
  test.fails('handle error in watch & watchEffect', async () => {
    const error1 = new Error('error1')
    const error2 = new Error('error2')
    const error3 = new Error('error3')
    const error4 = new Error('error4')
    const handler = vi.fn()

    const app = define({
      setup() {
        const count = ref(1)
        watch(
          count,
          () => {
            throw error1
          },
          { immediate: true },
        )
        watch(
          count,
          async () => {
            throw error2
          },
          { immediate: true },
        )
        watchEffect(() => {
          throw error3
        })
        watchEffect(async () => {
          throw error4
        })
      },
    }).create()

    app.app.config.errorHandler = handler
    app.mount()

    await nextTick()
    expect(handler).toHaveBeenCalledWith(error1, {}, 'watcher callback')
    expect(handler).toHaveBeenCalledWith(error2, {}, 'watcher callback')
    expect(handler).toHaveBeenCalledWith(error3, {}, 'watcher callback')
    expect(handler).toHaveBeenCalledWith(error4, {}, 'watcher callback')
    expect(handler).toHaveBeenCalledTimes(4)
  })

  // #9574
  test.fails('should pause tracking in error handler', async () => {
    const error = new Error('error')
    const x = ref(Math.random())

    const handler = vi.fn(() => {
      x.value
      x.value = Math.random()
    })

    const app = define({
      setup() {
        throw error
      },
    }).create()

    app.app.config.errorHandler = handler
    app.mount()

    await nextTick()
    expect(handler).toHaveBeenCalledWith(error, {}, 'render function')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  // native event handler handling should be tested in respective renderers
})
