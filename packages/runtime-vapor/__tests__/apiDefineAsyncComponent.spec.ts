import { nextTick, onActivated, ref } from '@vue/runtime-dom'
import { type VaporComponent, createComponent } from '../src/component'
import { defineVaporAsyncComponent } from '../src/apiDefineAsyncComponent'
import { makeRender } from './_utils'
import {
  VaporKeepAlive,
  createIf,
  createTemplateRefSetter,
  defineVaporComponent,
  renderEffect,
  template,
} from '@vue/runtime-vapor'
import { setElementText } from '../src/dom/prop'

const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

const define = makeRender()

describe('api: defineAsyncComponent', () => {
  test('simple usage', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const toggle = ref(true)
    const { html } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () => {
            return createComponent(Foo)
          },
        )
      },
    }).render()

    expect(html()).toBe('<!--async component--><!--if-->')
    resolve!(() => template('resolved')())

    await timeout()
    expect(html()).toBe('resolved<!--async component--><!--if-->')

    toggle.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')

    // already resolved component should update on nextTick
    toggle.value = true
    await nextTick()
    expect(html()).toBe('resolved<!--async component--><!--if-->')
  })

  test('with loading component', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise(r => {
          resolve = r as any
        }),
      loadingComponent: () => template('loading')(),
      delay: 1, // defaults to 200
    })

    const toggle = ref(true)
    const { html } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () => {
            return createComponent(Foo)
          },
        )
      },
    }).render()

    // due to the delay, initial mount should be empty
    expect(html()).toBe('<!--async component--><!--if-->')

    // loading show up after delay
    await timeout(1)
    expect(html()).toBe('loading<!--async component--><!--if-->')

    resolve!(() => template('resolved')())
    await timeout()
    expect(html()).toBe('resolved<!--async component--><!--if-->')

    toggle.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')

    // already resolved component should update on nextTick without loading
    // state
    toggle.value = true
    await nextTick()
    expect(html()).toBe('resolved<!--async component--><!--if-->')
  })

  test('with loading component + explicit delay (0)', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise(r => {
          resolve = r as any
        }),
      loadingComponent: () => template('loading')(),
      delay: 0,
    })

    const toggle = ref(true)
    const { html } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () => {
            return createComponent(Foo)
          },
        )
      },
    }).render()

    // with delay: 0, should show loading immediately
    expect(html()).toBe('loading<!--async component--><!--if-->')

    resolve!(() => template('resolved')())
    await timeout()
    expect(html()).toBe('resolved<!--async component--><!--if-->')

    toggle.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')

    // already resolved component should update on nextTick without loading
    // state
    toggle.value = true
    await nextTick()
    expect(html()).toBe('resolved<!--async component--><!--if-->')
  })

  test('error without error component', async () => {
    let resolve: (comp: VaporComponent) => void
    let reject: (e: Error) => void
    const Foo = defineVaporAsyncComponent(
      () =>
        new Promise((_resolve, _reject) => {
          resolve = _resolve as any
          reject = _reject
        }),
    )

    const toggle = ref(true)
    const { app, mount } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () => {
            return createComponent(Foo)
          },
        )
      },
    }).create()

    const handler = (app.config.errorHandler = vi.fn())
    const root = document.createElement('div')
    mount(root)
    expect(root.innerHTML).toBe('<!--async component--><!--if-->')

    const err = new Error('foo')
    reject!(err)
    await timeout()
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0]).toBe(err)
    expect(root.innerHTML).toBe('<!--async component--><!--if-->')

    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<!--if-->')

    // errored out on previous load, toggle and mock success this time
    toggle.value = true
    await nextTick()
    expect(root.innerHTML).toBe('<!--async component--><!--if-->')

    // should render this time
    resolve!(() => template('resolved')())
    await timeout()
    expect(root.innerHTML).toBe('resolved<!--async component--><!--if-->')
  })

  test('error with error component', async () => {
    let resolve: (comp: VaporComponent) => void
    let reject: (e: Error) => void
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise((_resolve, _reject) => {
          resolve = _resolve as any
          reject = _reject
        }),
      errorComponent: (props: { error: Error }) =>
        template(props.error.message)(),
    })

    const toggle = ref(true)
    const { app, mount } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () => {
            return createComponent(Foo)
          },
        )
      },
    }).create()
    const handler = (app.config.errorHandler = vi.fn())
    const root = document.createElement('div')
    mount(root)
    expect(root.innerHTML).toBe('<!--async component--><!--if-->')

    const err = new Error('errored out')
    reject!(err)
    await timeout()
    expect(handler).toHaveBeenCalled()
    expect(root.innerHTML).toBe('errored out<!--async component--><!--if-->')

    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<!--if-->')

    // errored out on previous load, toggle and mock success this time
    toggle.value = true
    await nextTick()
    expect(root.innerHTML).toBe('<!--async component--><!--if-->')

    // should render this time
    resolve!(() => template('resolved')())
    await timeout()
    expect(root.innerHTML).toBe('resolved<!--async component--><!--if-->')
  })

  test('error with error component, without global handler', async () => {
    let resolve: (comp: VaporComponent) => void
    let reject: (e: Error) => void
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise((_resolve, _reject) => {
          resolve = _resolve as any
          reject = _reject
        }),
      errorComponent: (props: { error: Error }) =>
        template(props.error.message)(),
    })

    const toggle = ref(true)
    const { mount } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () => {
            return createComponent(Foo)
          },
        )
      },
    }).create()
    const root = document.createElement('div')
    mount(root)
    expect(root.innerHTML).toBe('<!--async component--><!--if-->')

    const err = new Error('errored out')
    reject!(err)
    await timeout()
    expect(root.innerHTML).toBe('errored out<!--async component--><!--if-->')
    expect(
      'Unhandled error during execution of async component loader',
    ).toHaveBeenWarned()

    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<!--if-->')

    // errored out on previous load, toggle and mock success this time
    toggle.value = true
    await nextTick()
    expect(root.innerHTML).toBe('<!--async component--><!--if-->')

    // should render this time
    resolve!(() => template('resolved')())
    await timeout()
    expect(root.innerHTML).toBe('resolved<!--async component--><!--if-->')
  })

  test('error with error + loading components', async () => {
    let resolve: (comp: VaporComponent) => void
    let reject: (e: Error) => void
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise((_resolve, _reject) => {
          resolve = _resolve as any
          reject = _reject
        }),
      errorComponent: (props: { error: Error }) =>
        template(props.error.message)(),
      loadingComponent: () => template('loading')(),
      delay: 1,
    })

    const toggle = ref(true)
    const { app, mount } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () => {
            return createComponent(Foo)
          },
        )
      },
    }).create()
    const handler = (app.config.errorHandler = vi.fn())
    const root = document.createElement('div')
    mount(root)

    // due to the delay, initial mount should be empty
    expect(root.innerHTML).toBe('<!--async component--><!--if-->')

    // loading show up after delay
    await timeout(1)
    expect(root.innerHTML).toBe('loading<!--async component--><!--if-->')

    const err = new Error('errored out')
    reject!(err)
    await timeout()
    expect(handler).toHaveBeenCalled()
    expect(root.innerHTML).toBe('errored out<!--async component--><!--if-->')

    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<!--if-->')

    // errored out on previous load, toggle and mock success this time
    toggle.value = true
    await nextTick()
    expect(root.innerHTML).toBe('<!--async component--><!--if-->')

    // loading show up after delay
    await timeout(1)
    expect(root.innerHTML).toBe('loading<!--async component--><!--if-->')

    // should render this time
    resolve!(() => template('resolved')())
    await timeout()
    expect(root.innerHTML).toBe('resolved<!--async component--><!--if-->')
  })

  test('timeout without error component', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        }),
      timeout: 1,
    })

    const { app, mount } = define({
      setup() {
        return createComponent(Foo)
      },
    }).create()
    const handler = vi.fn()
    app.config.errorHandler = handler

    const root = document.createElement('div')
    mount(root)
    expect(root.innerHTML).toBe('<!--async component-->')

    await timeout(1)
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0].message).toMatch(
      `Async component timed out after 1ms.`,
    )
    expect(root.innerHTML).toBe('<!--async component-->')

    // if it resolved after timeout, should still work
    resolve!(() => template('resolved')())
    await timeout()
    expect(root.innerHTML).toBe('resolved<!--async component-->')
  })

  test('timeout with error component', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        }),
      timeout: 1,
      errorComponent: () => template('timed out')(),
    })

    const root = document.createElement('div')
    const { app, mount } = define({
      setup() {
        return createComponent(Foo)
      },
    }).create()

    const handler = (app.config.errorHandler = vi.fn())
    mount(root)
    expect(root.innerHTML).toBe('<!--async component-->')

    await timeout(1)
    expect(handler).toHaveBeenCalled()
    expect(root.innerHTML).toBe('timed out<!--async component-->')

    // if it resolved after timeout, should still work
    resolve!(() => template('resolved')())
    await timeout()
    expect(root.innerHTML).toBe('resolved<!--async component-->')
  })

  test('timeout with error + loading components', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        }),
      delay: 1,
      timeout: 16,
      errorComponent: () => template('timed out')(),
      loadingComponent: () => template('loading')(),
    })

    const root = document.createElement('div')
    const { app, mount } = define({
      setup() {
        return createComponent(Foo)
      },
    }).create()
    const handler = (app.config.errorHandler = vi.fn())
    mount(root)
    expect(root.innerHTML).toBe('<!--async component-->')
    await timeout(1)
    expect(root.innerHTML).toBe('loading<!--async component-->')

    await timeout(16)
    expect(root.innerHTML).toBe('timed out<!--async component-->')
    expect(handler).toHaveBeenCalled()

    resolve!(() => template('resolved')())
    await timeout()
    expect(root.innerHTML).toBe('resolved<!--async component-->')
  })

  test('timeout without error component, but with loading component', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        }),
      delay: 1,
      timeout: 16,
      loadingComponent: () => template('loading')(),
    })

    const root = document.createElement('div')
    const { app, mount } = define({
      setup() {
        return createComponent(Foo)
      },
    }).create()
    const handler = vi.fn()
    app.config.errorHandler = handler
    mount(root)
    expect(root.innerHTML).toBe('<!--async component-->')
    await timeout(1)
    expect(root.innerHTML).toBe('loading<!--async component-->')

    await timeout(16)
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0].message).toMatch(
      `Async component timed out after 16ms.`,
    )
    // should still display loading
    expect(root.innerHTML).toBe('loading<!--async component-->')

    resolve!(() => template('resolved')())
    await timeout()
    expect(root.innerHTML).toBe('resolved<!--async component-->')
  })

  test('retry (success)', async () => {
    let loaderCallCount = 0
    let resolve: (comp: VaporComponent) => void
    let reject: (e: Error) => void

    const Foo = defineVaporAsyncComponent({
      loader: () => {
        loaderCallCount++
        return new Promise((_resolve, _reject) => {
          resolve = _resolve as any
          reject = _reject
        })
      },
      onError(error, retry, fail) {
        if (error.message.match(/foo/)) {
          retry()
        } else {
          fail()
        }
      },
    })

    const root = document.createElement('div')
    const { app, mount } = define({
      setup() {
        return createComponent(Foo)
      },
    }).create()

    const handler = (app.config.errorHandler = vi.fn())
    mount(root)
    expect(root.innerHTML).toBe('<!--async component-->')
    expect(loaderCallCount).toBe(1)

    const err = new Error('foo')
    reject!(err)
    await timeout()
    expect(handler).not.toHaveBeenCalled()
    expect(loaderCallCount).toBe(2)
    expect(root.innerHTML).toBe('<!--async component-->')

    // should render this time
    resolve!(() => template('resolved')())
    await timeout()
    expect(handler).not.toHaveBeenCalled()
    expect(root.innerHTML).toBe('resolved<!--async component-->')
  })

  test('retry (skipped)', async () => {
    let loaderCallCount = 0
    let reject: (e: Error) => void

    const Foo = defineVaporAsyncComponent({
      loader: () => {
        loaderCallCount++
        return new Promise((_resolve, _reject) => {
          reject = _reject
        })
      },
      onError(error, retry, fail) {
        if (error.message.match(/bar/)) {
          retry()
        } else {
          fail()
        }
      },
    })

    const root = document.createElement('div')
    const { app, mount } = define({
      setup() {
        return createComponent(Foo)
      },
    }).create()

    const handler = (app.config.errorHandler = vi.fn())
    mount(root)
    expect(root.innerHTML).toBe('<!--async component-->')
    expect(loaderCallCount).toBe(1)

    const err = new Error('foo')
    reject!(err)
    await timeout()
    // should fail because retryWhen returns false
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0]).toBe(err)
    expect(loaderCallCount).toBe(1)
    expect(root.innerHTML).toBe('<!--async component-->')
  })

  test('retry (fail w/ max retry attempts)', async () => {
    let loaderCallCount = 0
    let reject: (e: Error) => void

    const Foo = defineVaporAsyncComponent({
      loader: () => {
        loaderCallCount++
        return new Promise((_resolve, _reject) => {
          reject = _reject
        })
      },
      onError(error, retry, fail, attempts) {
        if (error.message.match(/foo/) && attempts <= 1) {
          retry()
        } else {
          fail()
        }
      },
    })

    const root = document.createElement('div')
    const { app, mount } = define({
      setup() {
        return createComponent(Foo)
      },
    }).create()

    const handler = (app.config.errorHandler = vi.fn())
    mount(root)
    expect(root.innerHTML).toBe('<!--async component-->')
    expect(loaderCallCount).toBe(1)

    // first retry
    const err = new Error('foo')
    reject!(err)
    await timeout()
    expect(handler).not.toHaveBeenCalled()
    expect(loaderCallCount).toBe(2)
    expect(root.innerHTML).toBe('<!--async component-->')

    // 2nd retry, should fail due to reaching maxRetries
    reject!(err)
    await timeout()
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0]).toBe(err)
    expect(loaderCallCount).toBe(2)
    expect(root.innerHTML).toBe('<!--async component-->')
  })

  test('template ref forwarding', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const fooRef = ref<any>(null)
    const toggle = ref(true)
    const root = document.createElement('div')
    const { mount } = define({
      setup() {
        return { fooRef, toggle }
      },
      render() {
        return createIf(
          () => toggle.value,
          () => {
            const setTemplateRef = createTemplateRefSetter()
            const n0 = createComponent(Foo, null, null, true)
            setTemplateRef(n0, 'fooRef')
            return n0
          },
        )
      },
    }).create()
    mount(root)
    expect(root.innerHTML).toBe('<!--async component--><!--if-->')
    expect(fooRef.value).toBe(null)

    resolve!({
      setup: (props, { expose }) => {
        expose({
          id: 'foo',
        })
        return template('resolved')()
      },
    })
    // first time resolve, wait for macro task since there are multiple
    // microtasks / .then() calls
    await timeout()
    expect(root.innerHTML).toBe('resolved<!--async component--><!--if-->')
    expect(fooRef.value.id).toBe('foo')

    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<!--if-->')
    expect(fooRef.value).toBe(null)

    // already resolved component should update on nextTick
    toggle.value = true
    await nextTick()
    expect(root.innerHTML).toBe('resolved<!--async component--><!--if-->')
    expect(fooRef.value.id).toBe('foo')
  })

  test('the forwarded template ref should always exist when doing multi patching', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const fooRef = ref<any>(null)
    const toggle = ref(true)
    const updater = ref(0)

    const root = document.createElement('div')
    const { mount } = define({
      setup() {
        return { fooRef, toggle, updater }
      },
      render() {
        return createIf(
          () => toggle.value,
          () => {
            const setTemplateRef = createTemplateRefSetter()
            const n0 = createComponent(Foo, null, null, true)
            setTemplateRef(n0, 'fooRef')
            const n1 = template(`<span>`)()
            renderEffect(() => setElementText(n1, updater.value))
            return [n0, n1]
          },
        )
      },
    }).create()
    mount(root)

    expect(root.innerHTML).toBe('<!--async component--><span>0</span><!--if-->')
    expect(fooRef.value).toBe(null)

    resolve!({
      setup: (props, { expose }) => {
        expose({
          id: 'foo',
        })
        return template('resolved')()
      },
    })

    await timeout()
    expect(root.innerHTML).toBe(
      'resolved<!--async component--><span>0</span><!--if-->',
    )
    expect(fooRef.value.id).toBe('foo')

    updater.value++
    await nextTick()
    expect(root.innerHTML).toBe(
      'resolved<!--async component--><span>1</span><!--if-->',
    )
    expect(fooRef.value.id).toBe('foo')

    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<!--if-->')
    expect(fooRef.value).toBe(null)
  })

  test.todo('with suspense', async () => {})

  test.todo('suspensible: false', async () => {})

  test.todo('suspense with error handling', async () => {})

  test('with KeepAlive', async () => {
    const spy = vi.fn()
    let resolve: (comp: VaporComponent) => void

    const Foo = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const Bar = defineVaporAsyncComponent(() =>
      Promise.resolve(
        defineVaporComponent({
          setup() {
            return template('Bar')()
          },
        }),
      ),
    )

    const toggle = ref(true)
    const { html } = define({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => toggle.value,
              () => createComponent(Foo),
              () => createComponent(Bar),
            ),
        })
      },
    }).render()
    expect(html()).toBe('<!--async component--><!--if-->')

    await nextTick()
    resolve!(
      defineVaporComponent({
        setup() {
          onActivated(() => {
            spy()
          })
          return template('Foo')()
        },
      }),
    )

    await timeout()
    expect(html()).toBe('Foo<!--async component--><!--if-->')
    expect(spy).toBeCalledTimes(1)

    toggle.value = false
    await timeout()
    expect(html()).toBe('Bar<!--async component--><!--if-->')
  })

  test('with KeepAlive + include', async () => {
    const spy = vi.fn()
    let resolve: (comp: VaporComponent) => void

    const Foo = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const { html } = define({
      setup() {
        return createComponent(
          VaporKeepAlive,
          { include: () => 'Foo' },
          {
            default: () => createComponent(Foo),
          },
        )
      },
    }).render()
    expect(html()).toBe('<!--async component-->')

    await nextTick()
    resolve!(
      defineVaporComponent({
        name: 'Foo',
        setup() {
          onActivated(() => {
            spy()
          })
          return template('Foo')()
        },
      }),
    )

    await timeout()
    expect(html()).toBe('Foo<!--async component-->')
    expect(spy).toBeCalledTimes(1)
  })
})
