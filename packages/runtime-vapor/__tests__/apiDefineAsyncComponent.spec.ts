import {
  createApp,
  defineAsyncComponent,
  nextTick,
  onActivated,
  onMounted,
  ref,
  useId,
} from '@vue/runtime-dom'
import {
  type VaporComponent,
  type VaporComponentInstance,
  createComponent,
} from '../src/component'
import { defineVaporAsyncComponent } from '../src/apiDefineAsyncComponent'
import { compile, makeRender } from './_utils'
import {
  VaporKeepAlive,
  createIf,
  createSlot,
  createTemplateRefSetter,
  createVaporApp,
  defineVaporComponent,
  insert,
  renderEffect,
  template,
  vaporInteropPlugin,
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
    expect(html()).toBe('resolved<!--if-->')
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
    expect(html()).toBe('resolved<!--if-->')
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
    expect(html()).toBe('resolved<!--if-->')
  })

  test('passes props and slots to loading component', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise(r => {
          resolve = r as any
        }),
      loadingComponent: defineVaporComponent({
        props: ['msg'],
        setup(props: any) {
          const n0 = template('<div><span></span></div>')() as HTMLDivElement
          const label = n0.firstChild as HTMLSpanElement
          renderEffect(() => {
            setElementText(label, `loading:${props.msg}`)
          })
          insert(createSlot('default'), n0)
          return n0
        },
      }),
      delay: 0,
    })

    const msg = ref('foo')
    const { html } = define({
      setup() {
        return createComponent(
          Foo,
          { msg: () => msg.value },
          {
            default: () => template('<i>slot</i>')(),
          },
        )
      },
    }).render()

    expect(html()).toBe(
      '<div><span>loading:foo</span><i>slot</i><!--slot--></div><!--async component-->',
    )

    resolve!(() => template('resolved')())
    await timeout()
    expect(html()).toBe('resolved<!--async component-->')
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

  test('timeout without error component keeps the loading component mounted', async () => {
    let resolve: (comp: VaporComponent) => void
    const loadingSetup = vi.fn()
    const Loading = defineVaporComponent({
      setup() {
        loadingSetup()
        return template('loading')()
      },
    })
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        }),
      delay: 1,
      timeout: 16,
      loadingComponent: Loading,
    })

    const root = document.createElement('div')
    const { app, mount } = define({
      setup() {
        return createComponent(Foo)
      },
    }).create()
    app.config.errorHandler = vi.fn()
    mount(root)
    await timeout(1)
    expect(root.innerHTML).toBe('loading<!--async component-->')
    expect(loadingSetup).toHaveBeenCalledTimes(1)

    await timeout(16)
    expect(root.innerHTML).toBe('loading<!--async component-->')
    // the branch did not change, so the loading component must not be
    // torn down and recreated
    expect(loadingSetup).toHaveBeenCalledTimes(1)

    resolve!(() => template('resolved')())
    await timeout()
    expect(root.innerHTML).toBe('resolved<!--async component-->')
  })

  test('error component receives a later error in place', async () => {
    let reject: (e: Error) => void
    const errorSetup = vi.fn()
    const ErrorComp = defineVaporComponent({
      props: { error: Object },
      setup(props: { error: Error }) {
        errorSetup()
        const n = template(' ')() as Text
        renderEffect(() => setElementText(n, props.error.message))
        return n
      },
    })
    const Foo = defineVaporAsyncComponent({
      loader: () =>
        new Promise((_resolve, _reject) => {
          reject = _reject
        }),
      timeout: 1,
      errorComponent: ErrorComp,
    })

    const root = document.createElement('div')
    const { app, mount } = define({
      setup() {
        return createComponent(Foo)
      },
    }).create()
    app.config.errorHandler = vi.fn()
    mount(root)

    await timeout(1)
    expect(root.innerHTML).toBe(
      'Async component timed out after 1ms.<!--async component-->',
    )
    expect(errorSetup).toHaveBeenCalledTimes(1)

    // the pending loader rejects after the timeout: same branch, new error
    reject!(new Error('loader failed'))
    await timeout()
    expect(root.innerHTML).toBe('loader failed<!--async component-->')
    expect(errorSetup).toHaveBeenCalledTimes(1)
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
    expect(root.innerHTML).toBe('resolved<!--if-->')
    expect(fooRef.value.id).toBe('foo')
  })

  test('template ref forwarding should not keep stale ref callbacks before resolve', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const refA = ref<any>(null)
    const refB = ref<any>(null)
    const useA = ref(true)
    const root = document.createElement('div')

    const { mount } = define({
      setup() {
        return { refA, refB, useA }
      },
      render() {
        const setTemplateRef = createTemplateRefSetter()
        const n0 = createComponent(Foo, null, null, true)
        renderEffect(() => {
          setTemplateRef(n0, useA.value ? 'refA' : 'refB')
        })
        return n0
      },
    }).create()

    mount(root)
    expect(root.innerHTML).toBe('<!--async component-->')
    expect(refA.value).toBe(null)
    expect(refB.value).toBe(null)

    useA.value = false
    await nextTick()
    useA.value = true
    await nextTick()

    resolve!({
      setup: (props, { expose }) => {
        expose({
          id: 'foo',
        })
        return template('resolved')()
      },
    })
    await timeout()

    expect(root.innerHTML).toBe('resolved<!--async component-->')
    expect(refA.value.id).toBe('foo')
    expect(refB.value).toBe(null)
  })

  test('template ref forwarding should not keep stale ref callbacks after resolve', async () => {
    let resolve: (comp: VaporComponent) => void
    const Foo = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const refA = ref<any>(null)
    const refB = ref<any>(null)
    const useA = ref(true)
    const root = document.createElement('div')
    let asyncWrapper: any

    const { mount } = define({
      setup() {
        return { refA, refB, useA }
      },
      render() {
        const setTemplateRef = createTemplateRefSetter()
        const n0 = (asyncWrapper = createComponent(Foo, null, null, true))
        renderEffect(() => {
          setTemplateRef(n0, useA.value ? 'refA' : 'refB')
        })
        return n0
      },
    }).create()

    mount(root)
    expect(root.innerHTML).toBe('<!--async component-->')
    expect(refA.value).toBe(null)
    expect(refB.value).toBe(null)

    resolve!({
      setup: (props, { expose }) => {
        expose({
          id: 'foo',
        })
        return template('resolved')()
      },
    })
    await timeout()

    expect(root.innerHTML).toBe('resolved<!--async component-->')
    expect(refA.value.id).toBe('foo')
    expect(refB.value).toBe(null)

    useA.value = false
    await nextTick()
    expect(refA.value).toBe(null)
    expect(refB.value.id).toBe('foo')

    const updatedHooks = asyncWrapper.block.u
    if (updatedHooks) updatedHooks.forEach((hook: any) => hook())
    await nextTick()

    expect(refA.value).toBe(null)
    expect(refB.value.id).toBe('foo')
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

  test('resolved async component is created as its resolved component', async () => {
    let parent: VaporComponentInstance
    let appInstance: VaporComponentInstance
    const Inner = defineVaporComponent({
      setup(_, instance) {
        parent = (instance as unknown as VaporComponentInstance)
          .parent as VaporComponentInstance
        return template('resolved')()
      },
    })
    const Foo = defineVaporAsyncComponent(() => Promise.resolve(Inner))

    const toggle = ref(true)
    const { html } = define({
      setup(_, instance) {
        appInstance = instance as unknown as VaporComponentInstance
        return createIf(
          () => toggle.value,
          () => createComponent(Foo),
        )
      },
    }).render()
    expect(html()).toBe('<!--async component--><!--if-->')

    await timeout()
    expect(html()).toBe('resolved<!--async component--><!--if-->')
    expect(parent!.type).toBe(Foo)

    toggle.value = false
    await nextTick()
    toggle.value = true
    await nextTick()
    // no wrapper instance and no wrapper anchor once resolved
    expect(html()).toBe('resolved<!--if-->')
    expect(parent!).toBe(appInstance!)
  })

  test('useId is stable between pending and resolved mounts', async () => {
    const ids: string[] = []
    const Inner = defineVaporComponent({
      setup() {
        ids.push(useId())
        return template('inner')()
      },
    })
    const Sibling = defineVaporComponent({
      setup() {
        ids.push(useId())
        return template('sibling')()
      },
    })
    const Foo = defineVaporAsyncComponent(() => Promise.resolve(Inner))
    const App = defineVaporComponent({
      setup() {
        return [createComponent(Foo), createComponent(Sibling)]
      },
    })

    define(App).render({}, document.createElement('div'))
    await timeout()
    // the pending mount renders Inner after Sibling, so compare as sets
    const pendingIds = ids.splice(0).sort()
    expect(pendingIds).toHaveLength(2)

    define(App).render({}, document.createElement('div'))
    await timeout()
    expect(ids.sort()).toEqual(pendingIds)
  })

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

  test('with KeepAlive: reuses a resolved async component cached under its resolved component', async () => {
    const mounted = vi.fn()
    const activated = vi.fn()
    const Inner = defineVaporComponent({
      setup(_, { expose }) {
        const count = ref(0)
        expose({ inc: () => count.value++ })
        onMounted(mounted)
        onActivated(activated)
        const n = template(' ')() as Text
        renderEffect(() => setElementText(n, String(count.value)))
        return n
      },
    })
    const Foo = defineVaporAsyncComponent(() => Promise.resolve(Inner))
    // resolve before the KeepAlive child is ever created
    await (Foo as any).__asyncLoader()

    const toggle = ref(true)
    const fooRef = ref<any>(null)
    const { html } = define({
      setup() {
        const setRef = createTemplateRefSetter()
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => toggle.value,
              () => {
                const n0 = createComponent(Foo)
                setRef(n0, fooRef)
                return n0
              },
            ),
        })
      },
    }).render()
    expect(html()).toBe('0<!--if-->')
    expect(mounted).toHaveBeenCalledTimes(1)
    expect(activated).toHaveBeenCalledTimes(1)

    fooRef.value.inc()
    await nextTick()
    expect(html()).toBe('1<!--if-->')

    toggle.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')

    toggle.value = true
    await nextTick()
    expect(html()).toBe('1<!--if-->')
    expect(mounted).toHaveBeenCalledTimes(1)
    expect(activated).toHaveBeenCalledTimes(2)
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

  test('error component receives the wrapper props and attrs', async () => {
    const ErrorComp = `<script setup>defineProps(['item', 'error'])</script>
      <template><div class="err">{{ item.name }}: {{ error.message }}</div></template>`
    const App = `<components.Comp :item="{ name: data.name }" :class="data.cls"
      id="c" @click="data.clicks++" />`
    const html: Record<string, string> = {}
    for (const mode of ['vdom', 'vapor'] as const) {
      const { root, data, reject } = mountAsyncError(mode, ErrorComp, App)
      reject(new Error('failed'))
      await timeout()
      root.querySelector('div')!.click()
      expect(data.value.clicks).toBe(1)
      data.value.name = 'b'
      data.value.cls = 'y'
      await nextTick()
      html[mode] = root.innerHTML
    }
    expect(html.vdom).toBe('<div class="err y" id="c">b: failed</div>')
    expect(html.vapor).toBe(`${html.vdom}<!--async component-->`)
  })

  test('error component receives the wrapper props under Suspense', async () => {
    const ErrorComp = `<script setup>
      defineOptions({ inheritAttrs: false })
      defineProps(['item', 'error'])
      </script>
      <template><div>{{ item.name }} {{ $attrs.id }}</div></template>`
    const App = `<Suspense>
      <components.Comp :item="{ name: data.name }" id="c" />
      </Suspense>`
    const html: Record<string, string> = {}
    for (const mode of ['vdom', 'vapor'] as const) {
      const { root, data, reject } = mountAsyncError(mode, ErrorComp, App)
      reject(new Error('failed'))
      await timeout()
      data.value.name = 'b'
      await nextTick()
      html[mode] = root.innerHTML
    }
    expect(html.vdom).toBe('<div>b c</div>')
    expect(html.vapor).toBe(`${html.vdom}<!--async component-->`)
  })

  test('template ref on a dynamic component rendering a pending async component', async () => {
    let resolve: (comp: VaporComponent) => void
    const data = ref<any>({
      show: false,
      Async: defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            resolve = r as any
          }),
      ),
    })
    const Comp = compile(
      `<script setup vapor>defineExpose({ id: 'comp' })</script><template><div>comp</div></template>`,
      data,
    )
    const App = compile(
      `<script setup vapor>
        import { ref } from 'vue'
        const data = _data
        const components = _components
        const inst = ref(null)
        data.value.get = () => inst.value && inst.value.id
      </script>
      <template><component :is="data.show ? data.Async : components.Comp" ref="inst" /></template>`,
      data,
      { Comp },
    )
    const root = document.createElement('div')
    createVaporApp(App).mount(root)
    expect(data.value.get()).toBe('comp')

    data.value.show = true
    await nextTick()
    resolve!(
      compile(
        `<script setup vapor>defineExpose({ id: 'async' })</script><template><div>async</div></template>`,
        data,
      ),
    )
    await timeout()
    expect(root.innerHTML).toBe(
      '<div>async</div><!--async component--><!--dynamic-component-->',
    )
    expect(data.value.get()).toBe('async')
  })

  test('template ref on an initially pending dynamic async component', async () => {
    let resolve: (comp: VaporComponent) => void
    const onRef = vi.fn()
    const data = ref({ onRef })
    const Async = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )
    const App = compile(
      `<script setup vapor>
        const data = _data
        const components = _components
      </script>
      <template><component :is="components.Async" :ref="data.onRef" /></template>`,
      data,
      { Async },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    expect(onRef).toHaveBeenCalledTimes(1)
    expect(onRef.mock.calls[0][0]).toBe(null)

    resolve!(
      compile(
        `<script setup vapor>defineExpose({ id: 'async' })</script><template><div>async</div></template>`,
        data,
      ),
    )
    await timeout()
    expect(root.innerHTML).toBe(
      '<div>async</div><!--async component--><!--dynamic-component-->',
    )
    expect(onRef.mock.lastCall![0].id).toBe('async')
    expect(onRef.mock.calls.filter(([value]) => value !== null)).toHaveLength(1)
    app.unmount()
  })

  test('dynamic async template ref follows the active KeepAlive branch', async () => {
    let resolve: (comp: VaporComponent) => void
    const onRef = vi.fn()
    const data = ref({ useAsync: true, onRef })
    const Async = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )
    const Comp = compile(
      `<script setup vapor>defineExpose({ id: 'comp' })</script><template><div>comp</div></template>`,
      data,
    )
    const App = compile(
      `<script setup vapor>
        const data = _data
        const components = _components
      </script>
      <template><KeepAlive>
        <component :is="data.useAsync ? components.Async : components.Comp" :ref="data.onRef" />
      </KeepAlive></template>`,
      data,
      { Async, Comp },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)

    data.value.useAsync = false
    await nextTick()
    expect(onRef.mock.lastCall![0].id).toBe('comp')
    data.value.useAsync = true
    await nextTick()
    expect(onRef.mock.lastCall![0]).toBe(null)
    data.value.useAsync = false
    await nextTick()
    expect(onRef.mock.lastCall![0].id).toBe('comp')
    onRef.mockClear()

    resolve!(
      compile(
        `<script setup vapor>defineExpose({ id: 'async' })</script><template><div>async</div></template>`,
        data,
      ),
    )
    await timeout()
    expect(root.innerHTML).toBe('<div>comp</div><!--dynamic-component-->')
    expect(onRef).not.toHaveBeenCalled()

    data.value.useAsync = true
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div>async</div><!--async component--><!--dynamic-component-->',
    )
    expect(onRef.mock.lastCall![0].id).toBe('async')
    expect(onRef.mock.calls.filter(([value]) => value !== null)).toHaveLength(1)
    app.unmount()
  })

  test.each([true, false])(
    'dynamic async template ref is disposed with its KeepAlive binding (resolve while hidden: %s)',
    async resolveWhileHidden => {
      let resolve: (comp: VaporComponent) => void
      let current: any = null
      const onRef = vi.fn(value => {
        current = value
      })
      const data = ref({ show: true, useAsync: false, onRef })
      const Async = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            resolve = r as any
          }),
      )
      const Comp = compile(
        `<script setup vapor>defineExpose({ id: 'comp' })</script><template><div>comp</div></template>`,
        data,
      )
      const App = compile(
        `<script setup vapor>
        const data = _data
        const components = _components
      </script>
      <template><KeepAlive>
        <component v-if="data.show" :is="data.useAsync ? components.Async : components.Comp" :ref="data.onRef" />
      </KeepAlive></template>`,
        data,
        { Async, Comp },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)
      expect(current.id).toBe('comp')

      data.value.useAsync = true
      await nextTick()
      expect(current).toBe(null)
      data.value.show = false
      await nextTick()
      expect(current).toBe(null)
      if (!resolveWhileHidden) {
        data.value.show = true
        await nextTick()
        expect(current).toBe(null)
      }
      onRef.mockClear()

      resolve!(
        compile(
          `<script setup vapor>defineExpose({ id: 'async' })</script><template><div>async</div></template>`,
          data,
        ),
      )
      await timeout()
      if (resolveWhileHidden) {
        expect(root.innerHTML).toBe('<!--if-->')
        expect(current).toBe(null)
        expect(onRef).not.toHaveBeenCalled()

        data.value.show = true
        await nextTick()
      }
      expect(root.innerHTML).toBe(
        '<div>async</div><!--async component--><!--dynamic-component--><!--if-->',
      )
      expect(current.id).toBe('async')
      expect(onRef.mock.calls.filter(([value]) => value !== null)).toHaveLength(
        1,
      )

      data.value.show = false
      await nextTick()
      expect(current).toBe(null)
      onRef.mockClear()
      data.value.show = true
      await nextTick()
      expect(current.id).toBe('async')
      expect(onRef.mock.calls.filter(([value]) => value !== null)).toHaveLength(
        1,
      )
      app.unmount()
    },
  )

  test.each([false, true])(
    'forwards delivered wrapper inputs without resampling them (v-once: %s)',
    async once => {
      const source = ref('a')
      const sample = vi.fn(() => source.value)
      const data = ref({ sample })
      let resolve!: (component: VaporComponent) => void
      let read!: () => unknown
      const Child = defineVaporComponent({
        props: ['value'],
        setup(props) {
          read = () => props.value
          const node = template('<span></span>')()
          renderEffect(() => setElementText(node, String(props.value)))
          return node
        },
      })
      const Async = defineVaporAsyncComponent(
        () => new Promise<VaporComponent>(r => (resolve = r)),
      )
      const App = compile(
        `<template><div><components.Async ${once ? 'v-once' : ''}
          :value="data.sample()" /></div></template>`,
        data,
        { Async },
      )
      const { app, host } = define(App).render()
      expect(sample).toHaveBeenCalledTimes(1)

      source.value = 'b'
      await nextTick()
      expect(sample).toHaveBeenCalledTimes(once ? 1 : 2)
      resolve(Child)
      await timeout()

      const delivered = once ? 'a' : 'b'
      expect(host.textContent).toBe(delivered)
      expect(read()).toBe(delivered)
      expect(sample).toHaveBeenCalledTimes(once ? 1 : 2)

      source.value = 'c'
      expect(read()).toBe(delivered)
      await nextTick()
      expect(read()).toBe(once ? 'a' : 'c')
      expect(host.textContent).toBe(once ? 'a' : 'c')
      expect(sample).toHaveBeenCalledTimes(once ? 1 : 3)
      app.unmount()
    },
  )

  test('forwards delivered props and listeners to the error component without resampling sources', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const source = ref({ name: 'a', listener: first })
    const sample = vi.fn(() => ({
      item: { name: source.value.name },
      title: source.value.name,
      onClick: source.value.listener,
    }))
    const data = ref({ sample })
    const failure = new Error('failed')
    let reject!: (error: Error) => void
    const ErrorComp = compile(
      `<script setup>defineProps(['item', 'error'])</script>
       <template><button>{{ item.name }}:{{ error.message }}</button></template>`,
      data,
    )
    const Async = defineVaporAsyncComponent({
      loader: () => new Promise<VaporComponent>((_, r) => (reject = r)),
      errorComponent: ErrorComp,
    })
    const App = compile(
      '<template><div><components.Async v-bind="data.sample()" /></div></template>',
      data,
      { Async },
    )
    const { app, host, mount } = define(App).create()
    const errors: unknown[] = []
    app.config.errorHandler = error => errors.push(error)
    mount()
    expect(sample).toHaveBeenCalledTimes(1)

    reject(failure)
    await timeout()
    const button = host.querySelector('button')!
    expect(button.textContent).toBe('a:failed')
    expect(button.title).toBe('a')
    expect(sample).toHaveBeenCalledTimes(1)
    button.click()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()

    source.value = { name: 'b', listener: second }
    button.click()
    expect(first).toHaveBeenCalledTimes(2)
    expect(second).not.toHaveBeenCalled()
    await nextTick()

    expect(host.querySelector('button')).toBe(button)
    expect(button.textContent).toBe('b:failed')
    expect(button.title).toBe('b')
    expect(sample).toHaveBeenCalledTimes(2)
    button.click()
    expect(first).toHaveBeenCalledTimes(2)
    expect(second).toHaveBeenCalledTimes(1)
    expect(errors).toEqual([failure])
    app.unmount()
  })
})

function mountAsyncError(
  mode: 'vdom' | 'vapor',
  errorComponent: string,
  appTemplate: string,
) {
  const vapor = mode === 'vapor'
  const data = ref({ name: 'a', cls: 'x', clicks: 0 })
  const components: Record<string, any> = {}
  let reject: (err: Error) => void
  const define = (
    vapor ? defineVaporAsyncComponent : defineAsyncComponent
  ) as typeof defineAsyncComponent
  components.Comp = define({
    loader: () => new Promise((_, r) => (reject = r)),
    errorComponent: compile(errorComponent, data, components, { vapor }),
  })
  const App = compile(
    `<script setup>const data = _data; const components = _components;</script>` +
      `<template>${appTemplate}</template>`,
    data,
    components,
    { vapor },
  )
  const root = document.createElement('div')
  const app = vapor ? createVaporApp(App) : createApp(App)
  app.config.errorHandler = () => {}
  app.use(vaporInteropPlugin).mount(root)
  return { root, data, reject: (err: Error) => reject(err) }
}
