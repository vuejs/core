import { ref, nodeOps, h, render, nextTick, Ref } from '@vue/runtime-test'

// reference: https://vue-composition-api-rfc.netlify.com/api.html#template-refs

describe('api: template refs', () => {
  it('string ref mount', () => {
    const root = nodeOps.createElement('div')
    const el = ref(null)

    const Comp = {
      setup() {
        return {
          refKey: el
        }
      },
      render() {
        return h('div', { ref: 'refKey' })
      }
    }
    render(h(Comp), root)
    expect(el.value).toBe(root.children[0])
  })

  it('string ref update', async () => {
    const root = nodeOps.createElement('div')
    const fooEl = ref(null)
    const barEl = ref(null)
    const refKey = ref('foo')

    const Comp = {
      setup() {
        return {
          foo: fooEl,
          bar: barEl
        }
      },
      render() {
        return h('div', { ref: refKey.value })
      }
    }
    render(h(Comp), root)
    expect(fooEl.value).toBe(root.children[0])
    expect(barEl.value).toBe(null)

    refKey.value = 'bar'
    await nextTick()
    expect(fooEl.value).toBe(null)
    expect(barEl.value).toBe(root.children[0])
  })

  it('string ref unmount', async () => {
    const root = nodeOps.createElement('div')
    const el = ref(null)
    const toggle = ref(true)

    const Comp = {
      setup() {
        return {
          refKey: el
        }
      },
      render() {
        return toggle.value ? h('div', { ref: 'refKey' }) : null
      }
    }
    render(h(Comp), root)
    expect(el.value).toBe(root.children[0])

    toggle.value = false
    await nextTick()
    expect(el.value).toBe(null)
  })

  it('render function ref mount', () => {
    const root = nodeOps.createElement('div')
    const el = ref(null)

    const Comp = {
      setup() {
        return () => h('div', { ref: el })
      }
    }
    render(h(Comp), root)
    expect(el.value).toBe(root.children[0])
  })

  it('render function ref update', async () => {
    const root = nodeOps.createElement('div')
    const refs = {
      foo: ref(null),
      bar: ref(null)
    }
    const refKey: Ref<keyof typeof refs> = ref('foo')

    const Comp = {
      setup() {
        return () => h('div', { ref: refs[refKey.value] })
      }
    }
    render(h(Comp), root)
    expect(refs.foo.value).toBe(root.children[0])
    expect(refs.bar.value).toBe(null)

    refKey.value = 'bar'
    await nextTick()
    expect(refs.foo.value).toBe(null)
    expect(refs.bar.value).toBe(root.children[0])
  })

  it('render function ref unmount', async () => {
    const root = nodeOps.createElement('div')
    const el = ref(null)
    const toggle = ref(true)

    const Comp = {
      setup() {
        return () => (toggle.value ? h('div', { ref: el }) : null)
      }
    }
    render(h(Comp), root)
    expect(el.value).toBe(root.children[0])

    toggle.value = false
    await nextTick()
    expect(el.value).toBe(null)
  })
})
