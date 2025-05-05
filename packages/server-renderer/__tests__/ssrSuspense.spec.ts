import { Suspense, createApp, h } from 'vue'
import { renderToString } from '../src/renderToString'
import { expect } from 'vitest'

describe('SSR Suspense', () => {
  const ResolvingAsync = {
    async setup() {
      return () => h('div', 'async')
    },
  }

  const ResolvingSync = {
    setup() {
      return () => h('div', 'sync')
    },
  }

  const RejectingAsync = {
    setup() {
      return new Promise((_, reject) => reject('foo'))
    },
  }

  test('content', async () => {
    const Comp = {
      render() {
        return h(Suspense, null, {
          default: h(ResolvingAsync),
          fallback: h('div', 'fallback'),
        })
      },
    }

    expect(await renderToString(createApp(Comp))).toBe(`<div>async</div>`)
  })

  test('reject', async () => {
    const Comp = {
      errorCaptured: vi.fn(() => false),
      render() {
        return h(Suspense, null, {
          default: h(RejectingAsync),
          fallback: h('div', 'fallback'),
        })
      },
    }

    expect(await renderToString(createApp(Comp))).toBe(`<!---->`)

    expect(Comp.errorCaptured).toHaveBeenCalledTimes(1)
    expect('missing template').toHaveBeenWarned()
  })

  test('2 components', async () => {
    const Comp = {
      render() {
        return h(Suspense, null, {
          default: h('div', [h(ResolvingAsync), h(ResolvingAsync)]),
          fallback: h('div', 'fallback'),
        })
      },
    }

    expect(await renderToString(createApp(Comp))).toBe(
      `<div><div>async</div><div>async</div></div>`,
    )
  })

  test('resolving component + rejecting component', async () => {
    const Comp = {
      errorCaptured: vi.fn(() => false),
      render() {
        return h(Suspense, null, {
          default: h('div', [h(ResolvingAsync), h(RejectingAsync)]),
          fallback: h('div', 'fallback'),
        })
      },
    }

    expect(await renderToString(createApp(Comp))).toBe(
      `<div><div>async</div><!----></div>`,
    )

    expect(Comp.errorCaptured).toHaveBeenCalledTimes(1)
    expect('missing template or render function').toHaveBeenWarned()
  })

  test('suspense onResolve & ssr render & async', async () => {
    const onResolve = vi.fn()
    const Comp = {
      render() {
        return h(
          Suspense,
          {
            onResolve,
          },
          {
            default: h('div', [h(ResolvingAsync), h(ResolvingAsync)]),
            fallback: h('div', 'fallback'),
          },
        )
      },
    }
    expect(await renderToString(createApp(Comp))).toBe(
      `<div><div>async</div><div>async</div></div>`,
    )
    expect(onResolve).toHaveBeenCalledTimes(1)
  })

  test('suspense onResolve & ssr render & nested async deps', async () => {
    const onResolve = vi.fn()
    const child = {
      async setup() {
        return () => h(ResolvingAsync)
      },
    }
    const Comp = {
      render() {
        return h(
          Suspense,
          {
            onResolve,
          },
          {
            default: h('div', [h(child)]),
            fallback: h('div', 'fallback'),
          },
        )
      },
    }
    expect(await renderToString(createApp(Comp))).toBe(
      `<div><div>async</div></div>`,
    )
    expect(onResolve).toHaveBeenCalledTimes(1)
  })

  test('suspense onResolve & ssr render & sync', async () => {
    const onResolve = vi.fn()
    const Comp = {
      render() {
        return h(
          Suspense,
          {
            onResolve,
          },
          {
            default: h('div', [h(ResolvingSync), h(ResolvingSync)]),
            fallback: h('div', 'fallback'),
          },
        )
      },
    }
    expect(await renderToString(createApp(Comp))).toBe(
      `<div><div>sync</div><div>sync</div></div>`,
    )
    expect(onResolve).toHaveBeenCalledTimes(1)
  })

  test('nested suspense onResolve & ssr render', async () => {
    const onResolve = vi.fn()
    const onNestedResolve = vi.fn()
    const Comp = {
      render() {
        return h(
          Suspense,
          {
            onResolve,
          },
          {
            default: h(
              Suspense,
              {
                onResolve: onNestedResolve,
              },
              {
                default: h(ResolvingAsync),
              },
            ),
          },
        )
      },
    }
    expect(await renderToString(createApp(Comp))).toBe(`<div>async</div>`)
    expect(onResolve).toHaveBeenCalledTimes(1)
    expect(onNestedResolve).toHaveBeenCalledTimes(1)
  })

  test('failing suspense in passing suspense', async () => {
    const Comp = {
      errorCaptured: vi.fn(() => false),
      render() {
        return h(Suspense, null, {
          default: h('div', [
            h(ResolvingAsync),
            h(Suspense, null, {
              default: h('div', [h(RejectingAsync)]),
              fallback: h('div', 'fallback 2'),
            }),
          ]),
          fallback: h('div', 'fallback 1'),
        })
      },
    }

    expect(await renderToString(createApp(Comp))).toBe(
      `<div><div>async</div><div><!----></div></div>`,
    )

    expect(Comp.errorCaptured).toHaveBeenCalledTimes(1)
    expect('missing template').toHaveBeenWarned()
  })

  test('passing suspense in failing suspense', async () => {
    const Comp = {
      errorCaptured: vi.fn(() => false),
      render() {
        return h(Suspense, null, {
          default: h('div', [
            h(RejectingAsync),
            h(Suspense, null, {
              default: h('div', [h(ResolvingAsync)]),
              fallback: h('div', 'fallback 2'),
            }),
          ]),
          fallback: h('div', 'fallback 1'),
        })
      },
    }

    expect(await renderToString(createApp(Comp))).toBe(
      `<div><!----><div><div>async</div></div></div>`,
    )
    expect(Comp.errorCaptured).toHaveBeenCalledTimes(1)
    expect('missing template').toHaveBeenWarned()
  })
})
