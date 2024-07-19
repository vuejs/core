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
  useId,
} from 'vue'
import { renderToString } from '@vue/server-renderer'

type TestCaseFactory = () => [App, Promise<any>[]]

async function runOnClient(factory: TestCaseFactory) {
  const [app, deps] = factory()
  const root = document.createElement('div')
  app.mount(root)
  await Promise.all(deps)
  await promiseWithDelay(null, 0)
  return root.innerHTML
}

async function runOnServer(factory: TestCaseFactory) {
  const [app, _] = factory()
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
    ).toBe('v0:0 v0:1')
  })

  test('with config.idPrefix', async () => {
    expect(
      await getOutput(() => {
        const app = createApp(BasicComponentWithUseId)
        app.config.idPrefix = 'foo-'
        return [app, []]
      }),
    ).toBe('foo-0:0 foo-0:1')
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
      'v0:0 v0:1 ' + // root
      'v1:0 v1:1 ' + // inside first async subtree
      'v2:0 v2:1' // inside second async subtree
    // assert different async resolution order does not affect id stable-ness
    expect(await getOutput(() => factory(10, 20))).toBe(expected)
    expect(await getOutput(() => factory(20, 10))).toBe(expected)
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
      'v0:0 v0:1 ' + // root
      'v1:0 v1:1 ' + // inside first async subtree
      'v2:0 v2:1' // inside second async subtree
    // assert different async resolution order does not affect id stable-ness
    expect(await getOutput(() => factory(10, 20))).toBe(expected)
    expect(await getOutput(() => factory(20, 10))).toBe(expected)
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
      'v0:0 v0:1 ' + // root
      'v1:0 v1:1 ' + // inside first async subtree
      'v2:0 v2:1' + // inside second async subtree
      '</div>'
    // assert different async resolution order does not affect id stable-ness
    expect(await getOutput(() => factory(10, 20))).toBe(expected)
    expect(await getOutput(() => factory(20, 10))).toBe(expected)
  })
})
