import {
  h,
  ref,
  Suspense,
  ComponentOptions,
  render,
  nodeOps,
  serializeInner,
  nextTick
} from '@vue/runtime-test'

describe('renderer: suspense', () => {
  it('basic usage (nested + multiple deps)', async () => {
    const msg = ref('hello')
    const deps: Promise<any>[] = []

    const createAsyncComponent = (loader: () => Promise<ComponentOptions>) => ({
      async setup(props: any, { slots }: any) {
        const p = loader()
        deps.push(p)
        const Inner = await p
        return () => h(Inner, props, slots)
      }
    })

    const AsyncChild = createAsyncComponent(
      () =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              setup(props: { msg: string }) {
                return () => h('div', props.msg)
              }
            })
          }, 0)
        })
    )

    const AsyncChild2 = createAsyncComponent(
      () =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              setup(props: { msg: string }) {
                return () => h('div', props.msg)
              }
            })
          }, 10)
        })
    )

    const Mid = {
      setup() {
        return () =>
          h(AsyncChild, {
            msg: msg.value
          })
      }
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, [msg.value, h(Mid), h(AsyncChild2, { msg: 'child 2' })])
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<!---->`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<!---->hello<div>hello</div><div>child 2</div><!---->`
    )
  })

  test('fallback content', async () => {
    const deps: Promise<any>[] = []

    const Async = {
      async setup() {
        const p = new Promise(r => setTimeout(r, 1))
        deps.push(p)
        await p
        // test resume for returning bindings
        return {
          msg: 'async'
        }
      },
      render(this: any) {
        return h('div', this.msg)
      }
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(Async),
            fallback: h('div', 'fallback')
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>async</div>`)
  })

  test.todo('buffer mounted/updated hooks & watch callbacks')

  test.todo('content update before suspense resolve')

  test.todo('unmount before suspense resolve')

  test.todo('nested suspense')

  test.todo('error handling')
})
