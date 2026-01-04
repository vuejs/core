import { h, nodeOps, render, useInstanceOption } from '@vue/runtime-test'

describe('useInstanceOption', () => {
  test(`'ce' key`, () => {
    let hasInstance: boolean | undefined
    let ce: any
    const Comp = {
      setup() {
        const option = useInstanceOption('ce', true)
        hasInstance = option.hasInstance
        ce = option.value
        return () => null
      },
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(hasInstance).toBe(true)
    // custom element definition is not supported in test renderer, so check to access it is enough
    expect(ce).toBeUndefined()
  })

  test(`'type' key`, () => {
    let hasInstance: boolean | undefined
    let type: any
    const Comp = {
      __i18n: { locale: 'en' }, // inject by custom blocks
      setup() {
        const option = useInstanceOption('type', true)
        hasInstance = option.hasInstance
        type = option.value
        return () => null
      },
      mounted() {},
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(hasInstance).toBe(true)
    expect('setup' in type).toBe(true)
    expect('mounted' in type).toBe(true)
    expect(type.__i18n).toEqual({ locale: 'en' })
  })

  test(`'uid' key`, () => {
    let hasInstance: boolean | undefined
    let uid: any
    const Comp = {
      setup() {
        const option = useInstanceOption('uid', true)
        hasInstance = option.hasInstance
        uid = option.value
        return () => null
      },
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(hasInstance).toBe(true)
    expect(typeof uid).toBe('number')
  })

  test('not allowed key', () => {
    let hasInstance: boolean | undefined
    let value: any
    const Comp = {
      setup() {
        const option = useInstanceOption('foo' as any, true)
        hasInstance = option.hasInstance
        value = option.value
        return () => null
      },
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(hasInstance).toBe(true)
    expect(value).toBeUndefined()
    expect(
      `useInstanceOption only accepts  'ce', 'type', 'uid' as key, got 'foo'.`,
    ).toHaveBeenWarned()
  })

  test('not active instance', () => {
    const { hasInstance, value } = useInstanceOption('type')
    expect(hasInstance).toBe(false)
    expect(value).toBeUndefined()
    expect(
      'useInstanceOption called without an active component instance.',
    ).toHaveBeenWarned()
  })
})
