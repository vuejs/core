/**
 * @vitest-environment jsdom
 */
import {
  type App,
  Suspense,
  createApp,
  defineAsyncComponent,
  defineComponent,
  h,
  onServerPrefetch,
  useId,
} from 'vue'
import { renderToString } from '@vue/server-renderer'

type FactoryRes = [App, Promise<any>[]]
type TestCaseFactory = () => FactoryRes | Promise<FactoryRes>

async function runOnClient(factory: TestCaseFactory) {
  const [app, deps] = await factory()
  const root = document.createElement('div')
  app.mount(root)
  await Promise.all(deps)
  await promiseWithDelay(null, 0)
  return root.innerHTML
}

async function runOnServer(factory: TestCaseFactory) {
  const [app, _] = await factory()
  return (await renderToString(app))
    .replace(/<!--[\[\]]-->/g, '') // remove fragment wrappers
    .trim()
}

async function getOutput(factory: TestCaseFactory) {
  const clientResult = await runOnClient(factory)
  const serverResult = await runOnServer(factory)
  expect(serverResult).toBe(clientResult)
  return clientResult
}

function promiseWithDelay(res: any, delay: number) {
  return new Promise<any>(r => {
    setTimeout(() => r(res), delay)
  })
}

const BasicComponentWithUseId = defineComponent({
  setup() {
    const id1 = useId()
    const id2 = useId()
    return () => [id1, ' ', id2]
  },
})

describe('useId', () => {
  test('basic', async () => {
    expect(
      await getOutput(() => {
        const app = createApp(BasicComponentWithUseId)
        return [app, []]
      }),
    ).toBe('v-0 v-1')
  })

  test('with config.idPrefix', async () => {
    expect(
      await getOutput(() => {
        const app = createApp(BasicComponentWithUseId)
        app.config.idPrefix = 'foo'
        return [app, []]
      }),
    ).toBe('foo-0 foo-1')
  })

  test('async component', async () => {
    const factory = (
      delay1: number,
      delay2: number,
    ): ReturnType<TestCaseFactory> => {
      const p1 = promiseWithDelay(BasicComponentWithUseId, delay1)
      const p2 = promiseWithDelay(BasicComponentWithUseId, delay2)
      const AsyncOne = defineAsyncComponent(() => p1)
      const AsyncTwo = defineAsyncComponent(() => p2)
      const app = createApp({
        setup() {
          const id1 = useId()
          const id2 = useId()
          return () => [id1, ' ', id2, ' ', h(AsyncOne), ' ', h(AsyncTwo)]
        },
      })
      return [app, [p1, p2]]
    }

    const expected =
      'v-0 v-1 ' + // root
      'v-0-0 v-0-1 ' + // inside first async subtree
      'v-1-0 v-1-1' // inside second async subtree
    // assert different async resolution order does not affect id stable-ness
    expect(await getOutput(() => factory(0, 16))).toBe(expected)
    expect(await getOutput(() => factory(16, 0))).toBe(expected)
  })

  test('serverPrefetch', async () => {
    const factory = (
      delay1: number,
      delay2: number,
    ): ReturnType<TestCaseFactory> => {
      const p1 = promiseWithDelay(null, delay1)
      const p2 = promiseWithDelay(null, delay2)

      const SPOne = defineComponent({
        async serverPrefetch() {
          await p1
        },
        render() {
          return h(BasicComponentWithUseId)
        },
      })

      const SPTwo = defineComponent({
        async serverPrefetch() {
          await p2
        },
        render() {
          return h(BasicComponentWithUseId)
        },
      })

      const app = createApp({
        setup() {
          const id1 = useId()
          const id2 = useId()
          return () => [id1, ' ', id2, ' ', h(SPOne), ' ', h(SPTwo)]
        },
      })
      return [app, [p1, p2]]
    }

    const expected =
      'v-0 v-1 ' + // root
      'v-0-0 v-0-1 ' + // inside first async subtree
      'v-1-0 v-1-1' // inside second async subtree
    // assert different async resolution order does not affect id stable-ness
    expect(await getOutput(() => factory(0, 16))).toBe(expected)
    expect(await getOutput(() => factory(16, 0))).toBe(expected)
  })

  test('components with serverPrefetch', async () => {
    const factory = (): ReturnType<TestCaseFactory> => {
      const SPOne = defineComponent({
        setup() {
          onServerPrefetch(() => {})
          return () => h(BasicComponentWithUseId)
        },
      })

      const SPTwo = defineComponent({
        render() {
          return h(BasicComponentWithUseId)
        },
      })

      const app = createApp({
        setup() {
          const id1 = useId()
          const id2 = useId()
          return () => [id1, ' ', id2, ' ', h(SPOne), ' ', h(SPTwo)]
        },
      })
      return [app, []]
    }

    const expected =
      'v-0 v-1 ' + // root
      'v-0-0 v-0-1 ' + // inside first async subtree
      'v-2 v-3' // inside second async subtree
    // assert different async resolution order does not affect id stable-ness
    expect(await getOutput(() => factory())).toBe(expected)
    expect(await getOutput(() => factory())).toBe(expected)
  })

  test('async setup()', async () => {
    const factory = (
      delay1: number,
      delay2: number,
    ): ReturnType<TestCaseFactory> => {
      const p1 = promiseWithDelay(null, delay1)
      const p2 = promiseWithDelay(null, delay2)

      const ASOne = defineComponent({
        async setup() {
          await p1
          return {}
        },
        render() {
          return h(BasicComponentWithUseId)
        },
      })

      const ASTwo = defineComponent({
        async setup() {
          await p2
          return {}
        },
        render() {
          return h(BasicComponentWithUseId)
        },
      })

      const app = createApp({
        setup() {
          const id1 = useId()
          const id2 = useId()
          return () =>
            h(Suspense, null, {
              default: h('div', [id1, ' ', id2, ' ', h(ASOne), ' ', h(ASTwo)]),
            })
        },
      })
      return [app, [p1, p2]]
    }

    const expected =
      '<div>' +
      'v-0 v-1 ' + // root
      'v-0-0 v-0-1 ' + // inside first async subtree
      'v-1-0 v-1-1' + // inside second async subtree
      '</div>'
    // assert different async resolution order does not affect id stable-ness
    expect(await getOutput(() => factory(0, 16))).toBe(expected)
    expect(await getOutput(() => factory(16, 0))).toBe(expected)
  })

  test('deep nested', async () => {
    const factory = (): ReturnType<TestCaseFactory> => {
      const p = Promise.resolve()
      const One = {
        async setup() {
          const id = useId()
          await p
          return () => [id, ' ', h(Two), ' ', h(Three)]
        },
      }
      const Two = {
        async setup() {
          const id = useId()
          await p
          return () => [id, ' ', h(Three), ' ', h(Three)]
        },
      }
      const Three = {
        async setup() {
          const id = useId()
          return () => id
        },
      }
      const app = createApp({
        setup() {
          return () =>
            h(Suspense, null, {
              default: h(One),
            })
        },
      })
      return [app, [p]]
    }

    const expected =
      'v-0 ' + // One
      'v-0-0 ' + // Two
      'v-0-0-0 v-0-0-1 ' + // Three + Three nested in Two
      'v-0-1' // Three after Two
    // assert different async resolution order does not affect id stable-ness
    expect(await getOutput(() => factory())).toBe(expected)
    expect(await getOutput(() => factory())).toBe(expected)
  })

  test('async component inside async setup, already resolved', async () => {
    const factory = async (
      delay1: number,
      delay2: number,
    ): Promise<FactoryRes> => {
      const p1 = promiseWithDelay(null, delay1)
      const p2 = promiseWithDelay(BasicComponentWithUseId, delay2)
      const AsyncInner = defineAsyncComponent(() => p2)

      const AsyncSetup = defineComponent({
        async setup() {
          await p1
          return {}
        },
        render() {
          return h(AsyncInner)
        },
      })

      const app = createApp({
        setup() {
          const id1 = useId()
          const id2 = useId()
          return () =>
            h(Suspense, null, {
              default: h('div', [id1, ' ', id2, ' ', h(AsyncSetup)]),
            })
        },
      })

      // the async component may have already been resolved
      await AsyncInner.__asyncLoader()
      return [app, [p1, p2]]
    }

    const expected =
      '<div>' +
      'v-0 v-1 ' + // root
      'v-0-0-0 v-0-0-1' + // async component inside async setup
      '</div>'
    // assert different async resolution order does not affect id stable-ness
    expect(await getOutput(async () => factory(0, 16))).toBe(expected)
    expect(await getOutput(() => factory(16, 0))).toBe(expected)
  })
})
