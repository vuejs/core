import {
  popWarningContext,
  pushWarningContext,
  warn,
  warnWithSuggestion,
} from '../src/warning'
import type { ComponentInternalInstance, VNode } from '../src'

function makeFakeInstance(
  warnHandler: (msg: string, instance: any, trace: string) => void,
): ComponentInternalInstance {
  return {
    appContext: { config: { warnHandler } },
    proxy: null,
  } as unknown as ComponentInternalInstance
}

function pushFakeInstance(instance: ComponentInternalInstance): VNode {
  const vnode = {
    component: instance,
    type: {} as any,
    props: null,
    children: null,
    key: null,
    ref: null,
    scopeId: null,
    slotScopeIds: null,
  } as unknown as VNode
  pushWarningContext(vnode)
  return vnode
}

describe('warn (backward compat - AE4)', () => {
  test('emits [Vue warn]: prefix and spreads args byte-identically', () => {
    // direct spy so we can assert positional args beyond args[0]
    const spy = vi.spyOn(console, 'warn')
    warn('something is off', 42, { kind: 'demo' })

    expect(spy).toHaveBeenCalledTimes(1)
    const callArgs = spy.mock.calls[0]
    expect(callArgs[0]).toBe('[Vue warn]: something is off')
    expect(callArgs.slice(1)).toEqual([42, { kind: 'demo' }])
    spy.mockRestore()
  })

  test('with no positional args emits a single message string', () => {
    warn('plain message')

    expect('plain message').toHaveBeenWarned()
  })

  test('warnHandler formats positional args into the message', () => {
    const handler = vi.fn()
    const instance = makeFakeInstance(handler)
    const vnode = pushFakeInstance(instance)
    try {
      warn('handler test', 7)
      expect(handler).toHaveBeenCalledTimes(1)
      const [msg] = handler.mock.calls[0]
      expect(msg).toContain('handler test')
      expect(msg).toContain('7')
    } finally {
      popWarningContext()
    }
    // vnode is intentionally unused beyond push
    void vnode
  })
})

describe('warnWithSuggestion', () => {
  test('emits the suggestion as a visually distinct trailing line', () => {
    const spy = vi.spyOn(console, 'warn')
    warnWithSuggestion('value cannot be made reactive', 'Did you mean `ref()`?')

    expect(spy).toHaveBeenCalledTimes(1)
    const args = spy.mock.calls[0]
    expect(args[0]).toBe('[Vue warn]: value cannot be made reactive')
    // suggestion is a single trailing string that starts with a newline so
    // it renders on its own line in the console
    expect(args[args.length - 1]).toBe('\nDid you mean `ref()`?')
    spy.mockRestore()
  })

  test('preserves positional args between msg and suggestion', () => {
    const spy = vi.spyOn(console, 'warn')
    // signature: warnWithSuggestion(msg, suggestion, ...positionalArgs)
    warnWithSuggestion(
      'Invalid VNode type:',
      'Did you mean `div`?',
      'a div',
      '(typeof string)',
    )

    const args = spy.mock.calls[spy.mock.calls.length - 1]
    expect(args[0]).toBe('[Vue warn]: Invalid VNode type:')
    expect(args[1]).toBe('a div')
    expect(args[2]).toBe('(typeof string)')
    expect(args[args.length - 1]).toBe('\nDid you mean `div`?')
    spy.mockRestore()
  })

  test('warnHandler receives the suggestion on a new line in the formatted message', () => {
    const handler = vi.fn()
    const instance = makeFakeInstance(handler)
    pushFakeInstance(instance)
    try {
      warnWithSuggestion('reactive needs an object', 'Did you mean `ref()`?')
      expect(handler).toHaveBeenCalledTimes(1)
      const [msg] = handler.mock.calls[0]
      expect(msg).toContain('reactive needs an object')
      // suggestion is appended on its own line in the formatted message
      expect(msg).toContain('\nDid you mean `ref()`?')
    } finally {
      popWarningContext()
    }
  })

  test('re-entrancy guard: nested warn() inside handler does not double-emit', () => {
    const handler = vi.fn(() => {
      // nested warn — must be suppressed by the isWarning flag
      warn('nested from inside handler')
    })
    const instance = makeFakeInstance(handler)
    pushFakeInstance(instance)
    try {
      warnWithSuggestion('outer', 'Did you mean X?')
      expect(handler).toHaveBeenCalledTimes(1)
      // the nested warn did not emit through console.warn (the auto-spy)
      // because the isWarning re-entrancy guard suppressed it
      expect('nested from inside handler').not.toHaveBeenWarned()
    } finally {
      popWarningContext()
    }
  })
})
