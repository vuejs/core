import {
  onMounted,
  onErrorCaptured,
  render,
  h,
  nodeOps,
  watch,
  ref,
  nextTick,
  defineComponent,
  watchEffect
} from '@vue/runtime-test'
import { setErrorRecovery } from '../src/errorHandling'
import { mockWarn } from '@vue/shared'

describe('error handling', () => {
  mockWarn()

  beforeEach(() => {
    setErrorRecovery(true)
  })

  afterEach(() => {
    setErrorRecovery(false)
  })

  test('propagation', () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'root')
          return true
        })
        return () => h(Child)
      }
    }

    const Child = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'child')
        })
        return () => h(GrandChild)
      }
    }

    const GrandChild = {
      setup() {
        onMounted(() => {
          throw err
        })
        return () => null
      }
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook', 'root')
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook', 'child')
  })

  test('propagation stoppage', () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'root')
          return true
        })
        return () => h(Child)
      }
    }

    const Child = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'child')
          return true
        })
        return () => h(GrandChild)
      }
    }

    const GrandChild = {
      setup() {
        onMounted(() => {
          throw err
        })
        return () => null
      }
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook', 'child')
  })

  test('async error handling', async () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () => h(Child)
      }
    }

    const Child = {
      setup() {
        onMounted(async () => {
          throw err
        })
      },
      render() {}
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).not.toHaveBeenCalled()
    await new Promise(r => setTimeout(r))
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook')
  })

  test('error thrown in onErrorCaptured', () => {
    const err = new Error('foo')
    const err2 = new Error('bar')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () => h(Child)
      }
    }

    const Child = {
      setup() {
        onErrorCaptured(() => {
          throw err2
        })
        return () => h(GrandChild)
      }
    }

    const GrandChild = {
      setup() {
        onMounted(() => {
          throw err
        })
        return () => null
      }
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook')
    expect(fn).toHaveBeenCalledWith(err2, 'errorCaptured hook')
  })

  test('setup function', () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () => h(Child)
      }
    }

    const Child = {
      setup() {
        throw err
      },
      render() {}
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'setup function')
  })

  test('in render function', () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () => h(Child)
      }
    }

    const Child = {
      setup() {
        return () => {
          throw err
        }
      }
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'render function')
  })

  test('in function ref', () => {
    const err = new Error('foo')
    const ref = () => {
      throw err
    }
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () => h(Child)
      }
    }

    const Child = defineComponent(() => () => h('div', { ref }))

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'ref function')
  })

  test('in effect', () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () => h(Child)
      }
    }

    const Child = {
      setup() {
        watchEffect(() => {
          throw err
        })
        return () => null
      }
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'watcher callback')
  })

  test('in watch getter', () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () => h(Child)
      }
    }

    const Child = {
      setup() {
        watch(
          () => {
            throw err
          },
          () => {}
        )
        return () => null
      }
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'watcher getter')
  })

  test('in watch callback', async () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () => h(Child)
      }
    }

    const count = ref(0)
    const Child = {
      setup() {
        watch(
          () => count.value,
          () => {
            throw err
          }
        )
        return () => null
      }
    }

    render(h(Comp), nodeOps.createElement('div'))

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledWith(err, 'watcher callback')
  })

  test('in effect cleanup', async () => {
    const err = new Error('foo')
    const count = ref(0)
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () => h(Child)
      }
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
      }
    }

    render(h(Comp), nodeOps.createElement('div'))

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledWith(err, 'watcher cleanup function')
  })

  test('in component event handler via emit', () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () =>
          h(Child, {
            onFoo: () => {
              throw err
            }
          })
      }
    }

    const Child = {
      setup(props: any, { emit }: any) {
        emit('foo')
        return () => null
      }
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'component event handler')
  })

  test('in component event handler via emit (async)', async () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () =>
          h(Child, {
            async onFoo() {
              throw err
            }
          })
      }
    }

    const Child = {
      props: ['onFoo'],
      setup(props: any, { emit }: any) {
        emit('foo')
        return () => null
      }
    }

    render(h(Comp), nodeOps.createElement('div'))
    await nextTick()
    expect(fn).toHaveBeenCalledWith(err, 'component event handler')
  })

  test('in component event handler via emit (async + array)', async () => {
    const err = new Error('foo')
    const fn = jest.fn()

    const res: Promise<any>[] = []
    const createAsyncHandler = (p: Promise<any>) => () => {
      res.push(p)
      return p
    }

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return true
        })
        return () =>
          h(Child, {
            onFoo: [
              createAsyncHandler(Promise.reject(err)),
              createAsyncHandler(Promise.resolve(1))
            ]
          })
      }
    }

    const Child = {
      setup(props: any, { emit }: any) {
        emit('foo')
        return () => null
      }
    }

    render(h(Comp), nodeOps.createElement('div'))

    try {
      await Promise.all(res)
    } catch (e) {
      expect(e).toBe(err)
    }
    expect(fn).toHaveBeenCalledWith(err, 'component event handler')
  })

  it('should warn unhandled', () => {
    const onError = jest.spyOn(console, 'error')
    onError.mockImplementation(() => {})
    const groupCollapsed = jest.spyOn(console, 'groupCollapsed')
    groupCollapsed.mockImplementation(() => {})
    const log = jest.spyOn(console, 'log')
    log.mockImplementation(() => {})

    const err = new Error('foo')
    const fn = jest.fn()

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
        })
        return () => h(Child)
      }
    }

    const Child = {
      setup() {
        throw err
      },
      render() {}
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'setup function')
    expect(
      `Unhandled error during execution of setup function`
    ).toHaveBeenWarned()
    expect(onError).toHaveBeenCalledWith(err)

    onError.mockRestore()
    groupCollapsed.mockRestore()
    log.mockRestore()
  })

  // native event handler handling should be tested in respective renderers
})
