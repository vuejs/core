import {
  nextTick,
  onErrorCaptured,
  onMounted,
  ref,
  watch,
  watchEffect,
  withModifiers,
} from '@vue/runtime-dom'
import {
  createComponent,
  createIf,
  createInvoker,
  createSlot,
  createTemplateRefSetter,
  defineVaporComponent,
  delegate,
  delegateEvents,
  on,
  renderEffect,
  setDynamicEvents,
  template,
  withVaporKeys,
  withVaporModifiers,
} from '../src'
import { makeRender } from './_utils'
import type { VaporComponent } from '../src/component'
import type { RefEl } from '../src/apiTemplateRef'

const define = makeRender()

describe('error handling', () => {
  test('propagation', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp: VaporComponent = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'root')
          return false
        })

        return createComponent(Child)
      },
    }

    const Child: VaporComponent = {
      name: 'Child',
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'child')
        })
        return createComponent(GrandChild)
      },
    }

    const GrandChild: VaporComponent = {
      setup() {
        onMounted(() => {
          throw err
        })
        return []
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

    const Comp: VaporComponent = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'root')
          return false
        })
        return createComponent(Child)
      },
    }

    const Child: VaporComponent = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info, 'child')
          return false
        })
        return createComponent(GrandChild)
      },
    }

    const GrandChild: VaporComponent = {
      setup() {
        onMounted(() => {
          throw err
        })
        return []
      },
    }

    define(Comp).render()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(err, 'mounted hook', 'child')
  })

  test('async error handling', async () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp: VaporComponent = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child: VaporComponent = {
      setup() {
        onMounted(async () => {
          throw err
        })
        return []
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

    const Comp: VaporComponent = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child: VaporComponent = {
      setup() {
        onErrorCaptured(() => {
          throw err2
        })
        return createComponent(GrandChild)
      },
    }

    const GrandChild: VaporComponent = {
      setup() {
        onMounted(() => {
          throw err
        })
        return []
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
    expect(`returned non-block value`).toHaveBeenWarned()
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

  test('in slot fallback body', () => {
    const err = new Error('foo')
    const fn = vi.fn()

    const Comp: VaporComponent = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child = defineVaporComponent({
      setup() {
        return createSlot('default', null, () => {
          throw err
        })
      },
    })

    define(Comp).render()
    expect(fn).toHaveBeenCalledWith(err, 'setup function')
    expect(`returned non-block value`).toHaveBeenWarned()
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
        const setRef = createTemplateRefSetter()
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

    const Comp: VaporComponent = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child)
      },
    }

    const Child: VaporComponent = {
      setup() {
        watchEffect(() => {
          throw err
        })
        return []
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

    const Child: VaporComponent = {
      setup() {
        watch(
          () => {
            throw err
          },
          () => {},
        )
        return []
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
    const Child: VaporComponent = {
      setup() {
        watch(
          () => count.value,
          () => {
            throw err
          },
        )
        return []
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

    const Child: VaporComponent = {
      setup() {
        watchEffect(onCleanup => {
          count.value
          onCleanup(() => {
            throw err
          })
        })
        return []
      },
    }

    define(Comp).render()

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledWith(err, 'watcher cleanup function')
  })

  test('in dom event handler', () => {
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

    delegateEvents('click')
    const Child = defineVaporComponent({
      setup() {
        function onClick() {
          throw err
        }
        const n0 = template('<button>throw Error</button>', 1)() as any
        n0.$evtclick = createInvoker(onClick)
        return n0
      },
    })

    const { host } = define(Comp).render()
    const btn = host.querySelector('button') as HTMLButtonElement
    btn.click()
    expect(fn).toHaveBeenCalledWith(err, 'native event handler')
  })

  test('in dom event handler registered with on', () => {
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

    const Child = defineVaporComponent({
      setup() {
        function onClick() {
          throw err
        }
        const n0 = template('<button>throw Error</button>', 1)() as any
        on(n0, 'click', onClick)
        return n0
      },
    })

    const { host } = define(Comp).render()
    const btn = host.querySelector('button') as HTMLButtonElement
    btn.click()
    expect(fn).toHaveBeenCalledWith(err, 'native event handler')
  })

  test('in dom event handler registered with delegate', () => {
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

    delegateEvents('click')
    const Child = defineVaporComponent({
      setup() {
        function onClick() {
          throw err
        }
        const n0 = template('<button>throw Error</button>', 1)() as any
        delegate(n0, 'click', onClick)
        return n0
      },
    })

    const { host } = define(Comp).render()
    const btn = host.querySelector('button') as HTMLButtonElement
    btn.click()
    expect(fn).toHaveBeenCalledWith(err, 'native event handler')
  })

  test('in dom event handler registered with setDynamicEvents', () => {
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

    const Child = defineVaporComponent({
      setup() {
        function onClick() {
          throw err
        }
        const n0 = template('<button>throw Error</button>', 1)() as any
        renderEffect(() => {
          setDynamicEvents(n0, { click: onClick })
        })
        return n0
      },
    })

    const { host } = define(Comp).render()
    const btn = host.querySelector('button') as HTMLButtonElement
    btn.click()
    expect(fn).toHaveBeenCalledWith(err, 'native event handler')
  })

  test('in direct dom event handler registered with vapor modifier helpers', () => {
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

    delegateEvents('click', 'keyup')
    const Child = defineVaporComponent({
      setup() {
        const onClick = () => {
          throw err
        }
        const onKeyup = () => {
          throw err
        }
        const n0 = template('<button>throw Error</button>', 1)() as any
        n0.$evtclick = withVaporModifiers(onClick, ['self'])
        n0.$evtkeyup = withVaporKeys(withModifiers(onKeyup, ['self']), [
          'enter',
        ])
        return n0
      },
    })

    const { host } = define(Comp).render()
    const btn = host.querySelector('button') as HTMLButtonElement
    btn.click()
    btn.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }),
    )
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledWith(err, 'native event handler')
  })

  test('direct modifier invokers keep separate component boundaries', () => {
    const err = new Error('foo')
    const calls: string[] = []
    const onClick = () => {
      throw err
    }

    delegateEvents('click')
    const Child = defineVaporComponent({
      setup() {
        const n0 = template('<button>throw Error</button>', 1)() as any
        n0.$evtclick = withVaporModifiers(onClick, ['self'])
        return n0
      },
    })

    const createBoundary = (name: string) => ({
      setup() {
        onErrorCaptured((err, instance, info) => {
          calls.push(`${name}:${info}`)
          return false
        })
        return createComponent(Child)
      },
    })

    const Comp = {
      setup() {
        return [
          createComponent(createBoundary('one')),
          createComponent(createBoundary('two')),
        ]
      },
    }

    const { host } = define(Comp).render()
    const buttons = host.querySelectorAll('button')
    ;(buttons[0] as HTMLButtonElement).click()
    ;(buttons[1] as HTMLButtonElement).click()
    expect(calls).toEqual([
      'one:native event handler',
      'two:native event handler',
    ])
  })

  test('in dom event handler array registered with on (async)', async () => {
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

    const Child = defineVaporComponent({
      setup() {
        const onClick = async () => {
          throw err
        }
        const n0 = template('<button>throw Error</button>', 1)() as any
        on(n0, 'click', [onClick, () => {}])
        return n0
      },
    })

    const { host } = define(Comp).render()
    const btn = host.querySelector('button') as HTMLButtonElement
    btn.click()
    await nextTick()
    expect(fn).toHaveBeenCalledWith(err, 'native event handler')
  })

  test('in dom event handler registered with delegate (async)', async () => {
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

    delegateEvents('click')
    const Child = defineVaporComponent({
      setup() {
        const onClick = async () => {
          throw err
        }
        const n0 = template('<button>throw Error</button>', 1)() as any
        delegate(n0, 'click', onClick)
        return n0
      },
    })

    const { host } = define(Comp).render()
    const btn = host.querySelector('button') as HTMLButtonElement
    btn.click()
    await nextTick()
    expect(fn).toHaveBeenCalledWith(err, 'native event handler')
  })

  test('dom event invokers keep separate component boundaries', () => {
    const err = new Error('foo')
    const calls: string[] = []
    const onClick = () => {
      throw err
    }

    const Child = defineVaporComponent({
      setup() {
        const n0 = template('<button>throw Error</button>', 1)() as any
        on(n0, 'click', onClick)
        return n0
      },
    })

    const createBoundary = (name: string) => ({
      setup() {
        onErrorCaptured((err, instance, info) => {
          calls.push(`${name}:${info}`)
          return false
        })
        return createComponent(Child)
      },
    })

    const Comp = {
      setup() {
        return [
          createComponent(createBoundary('one')),
          createComponent(createBoundary('two')),
        ]
      },
    }

    const { host } = define(Comp).render()
    const buttons = host.querySelectorAll('button')
    ;(buttons[0] as HTMLButtonElement).click()
    ;(buttons[1] as HTMLButtonElement).click()
    expect(calls).toEqual([
      'one:native event handler',
      'two:native event handler',
    ])
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
          onFoo: () => () => {
            throw err
          },
        })
      },
    }

    const Child: VaporComponent = {
      setup(props: any, { emit }: any) {
        emit('foo')
        return []
      },
    }

    define(Comp).render()
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
        return createComponent(Child, {
          onFoo: () => async () => {
            throw err
          },
        })
      },
    }

    const Child: VaporComponent = {
      props: ['onFoo'],
      setup(props: any, { emit }: any) {
        emit('foo')
        return []
      },
    }

    define(Comp).render()
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

    const handlers = [
      createAsyncHandler(Promise.reject(err)),
      createAsyncHandler(Promise.resolve(1)),
    ]

    const Comp = {
      setup() {
        onErrorCaptured((err, instance, info) => {
          fn(err, info)
          return false
        })
        return createComponent(Child, {
          onFoo: () => handlers,
        })
      },
    }

    const Child: VaporComponent = {
      setup(props: any, { emit }: any) {
        emit('foo')
        return []
      },
    }

    define(Comp).render()

    await expect(() => Promise.all(res)).rejects.toThrowError()
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
        return []
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

  test('component can be updated and unmounted after setup error in production', async () => {
    __DEV__ = false
    try {
      const err = new Error('foo')
      const fn = vi.fn()
      const toggle = ref(true)

      const Child = defineVaporComponent({
        setup() {
          throw err
        },
      })

      const Comp: VaporComponent = {
        setup() {
          onErrorCaptured(err => {
            fn(err)
            return false
          })
          return createIf(
            () => toggle.value,
            () => createComponent(Child),
            () => template('<div>fallback</div>')(),
          )
        },
      }

      const { app, html } = define(Comp).render()
      expect(fn).toHaveBeenCalledWith(err)

      toggle.value = false
      await nextTick()
      expect(html()).toContain('fallback')

      expect(() => app.unmount()).not.toThrow()
    } finally {
      __DEV__ = true
    }
  })

  // native event handler handling should be tested in respective renderers
})
