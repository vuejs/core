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
        return () => h(Suspense, [msg.value, h(Mid)])
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<!---->`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->hello<div>hello</div><!---->`)
  })
})
