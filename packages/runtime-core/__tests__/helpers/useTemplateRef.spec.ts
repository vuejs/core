import {
  type ShallowRef,
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

    // @ts-expect-error
    tRef.value = 123

    expect(tRef!.value).toBe(root.children[0])
    expect('target is readonly').toHaveBeenWarned()
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

  // #11795
  test('should not attempt to set when variable name is same as key', () => {
    let tRef: ShallowRef
    const key = 'refKey'
    const Comp = {
      setup() {
        tRef = useTemplateRef('_')
        return {
          [key]: tRef,
        }
      },
      render() {
        return h('div', { ref: key })
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect('target is readonly').not.toHaveBeenWarned()
    expect(tRef!.value).toBe(null)
  })

  test('should work when used with direct ref value with ref_key', () => {
    let tRef: ShallowRef
    const key = 'refKey'
    const Comp = {
      setup() {
        tRef = useTemplateRef(key)
        return () => h('div', { ref: tRef, ref_key: key })
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect('target is readonly').not.toHaveBeenWarned()
    expect(tRef!.value).toBe(root.children[0])
  })

  test('should work when used with direct ref value with ref_key and ref_for', () => {
    let tRef: ShallowRef
    const key = 'refKey'
    const Comp = {
      setup() {
        tRef = useTemplateRef(key)
      },
      render() {
        return h(
          'div',
          [1, 2, 3].map(x =>
            h('span', { ref: tRef, ref_key: key, ref_for: true }, x.toString()),
          ),
        )
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect('target is readonly').not.toHaveBeenWarned()
    expect(tRef!.value).toHaveLength(3)
  })

  test('should work when used with direct ref value with ref_key and dynamic value', async () => {
    const refMode = ref('h1-ref')

    let tRef: ShallowRef
    const key = 'refKey'

    const Comp = {
      setup() {
        tRef = useTemplateRef(key)
      },
      render() {
        switch (refMode.value) {
          case 'h1-ref':
            return h('h1', { ref: tRef, ref_key: key })
          case 'h2-ref':
            return h('h2', { ref: tRef, ref_key: key })
          case 'no-ref':
            return h('span')
          case 'nothing':
            return null
        }
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect(tRef!.value.tag).toBe('h1')

    refMode.value = 'h2-ref'
    await nextTick()
    expect(tRef!.value.tag).toBe('h2')

    refMode.value = 'no-ref'
    await nextTick()
    expect(tRef!.value).toBeNull()

    refMode.value = 'nothing'
    await nextTick()
    expect(tRef!.value).toBeNull()

    expect('target is readonly').not.toHaveBeenWarned()
  })

  test('should work when used with dynamic direct refs and ref_keys', async () => {
    const refKey = ref('foo')

    let tRefs: Record<string, ShallowRef>

    const Comp = {
      setup() {
        tRefs = {
          foo: useTemplateRef('foo'),
          bar: useTemplateRef('bar'),
        }
      },
      render() {
        return h('div', { ref: tRefs[refKey.value], ref_key: refKey.value })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect(tRefs!['foo'].value).toBe(root.children[0])
    expect(tRefs!['bar'].value).toBeNull()

    refKey.value = 'bar'
    await nextTick()
    expect(tRefs!['foo'].value).toBeNull()
    expect(tRefs!['bar'].value).toBe(root.children[0])

    expect('target is readonly').not.toHaveBeenWarned()
  })

  test('should not work when used with direct ref value without ref_key (in dev mode)', () => {
    let tRef: ShallowRef
    const Comp = {
      setup() {
        tRef = useTemplateRef('refKey')
        return () => h('div', { ref: tRef })
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)

    expect(tRef!.value).toBeNull()
  })

  test('should work when used as direct ref value (compiled in prod mode)', () => {
    __DEV__ = false
    try {
      let foo: ShallowRef
      const Comp = {
        setup() {
          foo = useTemplateRef('foo')
          return () => h('div', { ref: foo })
        },
      }
      const root = nodeOps.createElement('div')
      render(h(Comp), root)

      expect('target is readonly').not.toHaveBeenWarned()
      expect(foo!.value).toBe(root.children[0])
    } finally {
      __DEV__ = true
    }
  })

  test('should work when used as direct ref value with ref_key and ref_for (compiled in prod mode)', () => {
    __DEV__ = false
    try {
      let tRef: ShallowRef
      const key = 'refKey'
      const Comp = {
        setup() {
          tRef = useTemplateRef(key)
        },
        render() {
          return h(
            'div',
            [1, 2, 3].map(x =>
              h(
                'span',
                { ref: tRef, ref_key: key, ref_for: true },
                x.toString(),
              ),
            ),
          )
        },
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)

      expect('target is readonly').not.toHaveBeenWarned()
      expect(tRef!.value).toHaveLength(3)
    } finally {
      __DEV__ = true
    }
  })

  test('should work when used as direct ref value with ref_for but without ref_key (compiled in prod mode)', () => {
    __DEV__ = false
    try {
      let tRef: ShallowRef
      const Comp = {
        setup() {
          tRef = useTemplateRef('refKey')
        },
        render() {
          return h(
            'div',
            [1, 2, 3].map(x =>
              h('span', { ref: tRef, ref_for: true }, x.toString()),
            ),
          )
        },
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)

      expect('target is readonly').not.toHaveBeenWarned()
      expect(tRef!.value).toHaveLength(3)
    } finally {
      __DEV__ = true
    }
  })
})
