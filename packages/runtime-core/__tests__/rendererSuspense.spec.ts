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
  it('should work', async () => {
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

    // TODO test mounted hook & watch callback buffering
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
      name: 'root',
      setup() {
        // TODO test fallback
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

  test.todo('fallback content update')

  test.todo('content update before suspense resolve')

  test.todo('unmount before suspense resolve')

  test.todo('nested suspense')
})
