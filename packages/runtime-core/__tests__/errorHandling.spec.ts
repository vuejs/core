import {
  type VNode,
  computed,
  createApp,
  defineComponent,
  h,
  nextTick,
  nodeOps,
  onErrorCaptured,
  onMounted,
  ref,
  render,
  watch,
  watchEffect,
} from '@vue/runtime-test'
import { ErrorCodes, ErrorTypeStrings } from '../src/errorHandling'

describe('error handling', () => {
  test('propagation', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'root')
          return false
        })
        return () => h(Child)
      },
    }

    const Child = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'child')
        })
        return () => h(GrandChild)
      },
    }

    const GrandChild = {
      setup() {
        onMounted(() => {
          throw err
        })
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))
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
        return () => h(Child)
      },
    }

    const Child = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'child')
          return false
        })
        return () => h(GrandChild)
      },
    }

    const GrandChild = {
      setup() {
        onMounted(() => {
          throw err
        })
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))
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
        return () => h(Child)
      },
    }

    const Child = {
      setup() {
        onMounted(async () => {
          throw err
        })
      },
      render() {},
    }

    render(h(Comp), nodeOps.createElement('div'))
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
        return () => h(Child)
      },
    }

    const Child = {
      setup() {
        onErrorCaptured(() => {
          throw err2
        })
        return () => h(GrandChild)
      },
    }

    const GrandChild = {
      setup() {
        onMounted(() => {
          throw err
        })
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))
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
        return () => h(Child)
      },
    }

    const Child = {
      setup() {
        throw err
      },
      render() {},
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'setup function')
  })

  // unlike other lifecycle hooks, created/beforeCreate are called as part of
  // the options API initialization process instead of by the renderer.
  test('in created/beforeCreate hook', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return () => [h(Child1), h(Child2)]
      },
    }

    const Child1 = {
      created() {
        throw err
      },
      render() {},
    }

    const Child2 = {
      beforeCreate() {
        throw err
      },
      render() {},
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'created hook')
    expect(fn).toHaveBeenCalledWith(err, 'beforeCreate hook')
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
        return () => h(Child)
      },
    }

    const Child = {
      setup() {
        return () => {
          throw err
        }
      },
    }

    render(h(Comp), nodeOps.createElement('div'))
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
        return () => h(Child)
      },
    }

    const Child = defineComponent(() => () => h('div', { ref }))

    render(h(Comp), nodeOps.createElement('div'))
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
        return () => h(Child)
      },
    }

    const Child = {
      setup() {
        watchEffect(() => {
          throw err
        })
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))
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
        return () => h(Child)
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
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))
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
        return () => h(Child)
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
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))

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
        return () => h(Child)
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
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))

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
        return () =>
          h(Child, {
            onFoo: () => {
              throw err
            },
          })
      },
    }

    const Child = {
      setup(props: any, { emit }: any) {
        emit('foo')
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'component event handler')
  })

  test('in component event handler via emit (async)', async () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return () =>
          h(Child, {
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
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))
    await nextTick()
    expect(fn).toHaveBeenCalledWith(err, 'component event handler')
  })

  test('in component event handler via emit (async + array)', async () => {
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
        return () =>
          h(Child, {
            onFoo: [
              createAsyncHandler(Promise.reject(err)),
              createAsyncHandler(Promise.resolve(1)),
            ],
          })
      },
    }

    const Child = {
      setup(props: any, { emit }: any) {
        emit('foo')
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))

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
        return () => h(Child)
      },
    }

    const Child = {
      setup() {
        throw err
      },
      render() {},
    }

    let caughtError
    try {
      render(h(Comp), nodeOps.createElement('div'))
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
  test('handle error in watch & watchEffect', async () => {
    const error1 = new Error('error1')
    const error2 = new Error('error2')
    const error3 = new Error('error3')
    const error4 = new Error('error4')
    const handler = vi.fn()

    const app = createApp({
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
      render() {},
    })

    app.config.errorHandler = handler
    app.mount(nodeOps.createElement('div'))

    await nextTick()
    expect(handler).toHaveBeenCalledWith(error1, {}, 'watcher callback')
    expect(handler).toHaveBeenCalledWith(error2, {}, 'watcher callback')
    expect(handler).toHaveBeenCalledWith(error3, {}, 'watcher callback')
    expect(handler).toHaveBeenCalledWith(error4, {}, 'watcher callback')
    expect(handler).toHaveBeenCalledTimes(4)
  })

  // #9574
  test('should pause tracking in error handler', async () => {
    const error = new Error('error')
    const x = ref(Math.random())

    const handler = vi.fn(() => {
      x.value
      x.value = Math.random()
    })

    const app = createApp({
      setup() {
        return () => {
          throw error
        }
      },
    })

    app.config.errorHandler = handler
    app.mount(nodeOps.createElement('div'))

    await nextTick()
    expect(handler).toHaveBeenCalledWith(error, {}, 'render function')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('errors in scheduler job with owner instance should be caught', async () => {
    let vnode: VNode
    const x = ref(0)
    const app = createApp({
      render() {
        return (vnode = vnode || h('div', x.value))
      },
    })

    app.config.errorHandler = vi.fn()
    app.mount(nodeOps.createElement('div'))

    const error = new Error('error')
    Object.defineProperty(vnode!, 'el', {
      get() {
        throw error
      },
    })

    x.value++
    await nextTick()
    expect(app.config.errorHandler).toHaveBeenCalledWith(
      error,
      {},
      ErrorTypeStrings[ErrorCodes.COMPONENT_UPDATE],
    )
  })

  // #11286
  test('handle error in computed', async () => {
    const err = new Error()
    const handler = vi.fn()

    const count = ref(1)
    const x = computed(() => {
      if (count.value === 2) throw err
      return count.value + 1
    })

    const app = createApp({
      setup() {
        return () => x.value
      },
    })

    app.config.errorHandler = handler
    app.mount(nodeOps.createElement('div'))

    count.value = 2

    await nextTick()
    expect(handler).toHaveBeenCalledWith(
      err,
      {},
      ErrorTypeStrings[ErrorCodes.COMPONENT_UPDATE],
    )
  })

  // #11624
  test('in computed that is used as key for watch', async () => {
    const err = new Error('foo')
    const fn = vi.fn()
    const trigger = ref(false)

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return () => h(Child)
      },
    }

    const Child = {
      setup() {
        const foo = computed(() => {
          if (trigger.value) throw err
          return 1
        })
        watch(foo, () => {})
        return () => null
      },
    }

    render(h(Comp), nodeOps.createElement('div'))

    trigger.value = true
    await nextTick()
    expect(fn).toHaveBeenCalledWith(
      err,
      ErrorTypeStrings[ErrorCodes.COMPONENT_UPDATE],
    )
  })

  // native event handler handling should be tested in respective renderers
})
