import {
  onMounted,
  onErrorCaptured,
  render,
  h,
  nodeOps,
  watch,
  ref,
  nextTick
} from '@vue/runtime-test'

describe('error handling', () => {
  test('propagtaion', () => {
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

  test('in watch (simple usage)', () => {
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
        watch(() => {
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

  test('in watch callback', () => {
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
          () => 1,
          () => {
            throw err
          }
        )
        return () => null
      }
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledWith(err, 'watcher callback')
  })

  test('in watch cleanup', async () => {
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
        watch(onCleanup => {
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

  test('in component event handler', () => {
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

  // native event handler handling should be tested in respective renderers
})
