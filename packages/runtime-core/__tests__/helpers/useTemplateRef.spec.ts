import {
  h,
  nextTick,
  nodeOps,
  ref,
  render,
  useTemplateRef,
} from '@vue/runtime-test'

describe('useTemplateRef', () => {
  test('should work', () => {
    let tRef
    const key = 'refKey'
    const Comp = {
      setup() {
        tRef = useTemplateRef(key)
      },
      render() {
        return h('div', { ref: key })
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(tRef!.value).toBe(root.children[0])
  })

  test('should be readonly', () => {
    let tRef
    const key = 'refKey'
    const key2 = 'foo'
    const Comp = {
      setup() {
        tRef = useTemplateRef(key)
        // naming a variable declared with the same as a template ref
        const foo = useTemplateRef(key2)
        return { [key2]: foo }
      },
      render() {
        return h('div', { ref: key }, [h('div', { ref: key2 })])
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    // @ts-expect-error
    tRef.value = 123

    expect(tRef!.value).toBe(root.children[0])
    expect('target is readonly').toHaveBeenWarnedTimes(1)
  })

  test('should be updated for ref of dynamic strings', async () => {
    let t1, t2
    const key = ref('t1')
    const Comp = {
      setup() {
        t1 = useTemplateRef<HTMLAnchorElement>('t1')
        t2 = useTemplateRef('t2')
      },
      render() {
        return h('div', { ref: key.value })
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect(t1!.value).toBe(root.children[0])
    expect(t2!.value).toBe(null)

    key.value = 't2'
    await nextTick()
    expect(t2!.value).toBe(root.children[0])
    expect(t1!.value).toBe(null)
  })

  test('should warn on duplicate useTemplateRef', () => {
    const root = nodeOps.createElement('div')
    render(
      h(() => {
        useTemplateRef('foo')
        useTemplateRef('foo')
        return ''
      }),
      root,
    )

    expect(`useTemplateRef('foo') already exists.`).toHaveBeenWarned()
  })
})
