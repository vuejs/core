import { patchEvent } from '../../src/modules/events'
import { withKeys, withModifiers } from '@vue/runtime-dom'

function triggerEvent(
  target: Element,
  event: string,
  process?: (e: any) => any,
) {
  const e = new Event(event, {
    bubbles: true,
    cancelable: true,
  })
  if (event === 'click') {
    ;(e as any).button = 0
  }
  if (process) process(e)
  target.dispatchEvent(e)
  return e
}

describe('runtime-dom: v-on directive', () => {
  test('it should support "stop" and "prevent"', () => {
    const parent = document.createElement('div')
    const child = document.createElement('input')
    parent.appendChild(child)
    const childNextValue = withModifiers(vi.fn(), ['prevent', 'stop'])
    patchEvent(child, 'onClick', null, childNextValue, null)
    const parentNextValue = vi.fn()
    patchEvent(parent, 'onClick', null, parentNextValue, null)
    expect(triggerEvent(child, 'click').defaultPrevented).toBe(true)
    expect(parentNextValue).not.toBeCalled()
  })

  test('it should support "self"', () => {
    const parent = document.createElement('div')
    const child = document.createElement('input')
    parent.appendChild(child)
    const fn = vi.fn()
    const handler = withModifiers(fn, ['self'])
    patchEvent(parent, 'onClick', null, handler, null)
    triggerEvent(child, 'click')
    expect(fn).not.toBeCalled()
  })

  test('it should support key modifiers and system modifiers', () => {
    const keyNames = ['ctrl', 'shift', 'meta', 'alt']

    keyNames.forEach(keyName => {
      const el = document.createElement('div')
      const fn = vi.fn()
      // <div @keyup[keyName].esc="test"/>
      const nextValue = withKeys(withModifiers(fn, [keyName]), [
        'esc',
        'arrow-left',
      ])
      patchEvent(el, 'onKeyup', null, nextValue, null)

      triggerEvent(el, 'keyup', e => (e.key = 'a'))
      expect(fn).not.toBeCalled()

      triggerEvent(el, 'keyup', e => {
        e[`${keyName}Key`] = false
        e.key = 'esc'
      })
      expect(fn).not.toBeCalled()

      triggerEvent(el, 'keyup', e => {
        e[`${keyName}Key`] = true
        e.key = 'Escape'
      })
      expect(fn).toBeCalledTimes(1)

      triggerEvent(el, 'keyup', e => {
        e[`${keyName}Key`] = true
        e.key = 'ArrowLeft'
      })
      expect(fn).toBeCalledTimes(2)
    })
  })

  test('it should support "exact" modifier', () => {
    const el = document.createElement('div')
    // Case 1: <div @keyup.exact="test"/>
    const fn1 = vi.fn()
    const next1 = withModifiers(fn1, ['exact'])
    patchEvent(el, 'onKeyup', null, next1, null)
    triggerEvent(el, 'keyup')
    expect(fn1.mock.calls.length).toBe(1)
    triggerEvent(el, 'keyup', e => (e.ctrlKey = true))
    expect(fn1.mock.calls.length).toBe(1)
    // Case 2: <div @keyup.ctrl.a.exact="test"/>
    const fn2 = vi.fn()
    const next2 = withKeys(withModifiers(fn2, ['ctrl', 'exact']), ['a'])
    patchEvent(el, 'onKeyup', null, next2, null)
    triggerEvent(el, 'keyup', e => (e.key = 'a'))
    expect(fn2).not.toBeCalled()
    triggerEvent(el, 'keyup', e => {
      e.key = 'a'
      e.ctrlKey = true
    })
    expect(fn2.mock.calls.length).toBe(1)
    triggerEvent(el, 'keyup', e => {
      // should not trigger if has other system modifiers
      e.key = 'a'
      e.ctrlKey = true
      e.altKey = true
    })
    expect(fn2.mock.calls.length).toBe(1)
  })

  it('should support mouse modifiers', () => {
    const buttons = ['left', 'middle', 'right'] as const
    const buttonCodes = { left: 0, middle: 1, right: 2 }
    buttons.forEach(button => {
      const el = document.createElement('div')
      const fn = vi.fn()
      const handler = withModifiers(fn, [button])
      patchEvent(el, 'onMousedown', null, handler, null)
      buttons
        .filter(b => b !== button)
        .forEach(button => {
          triggerEvent(el, 'mousedown', e => (e.button = buttonCodes[button]))
        })
      expect(fn).not.toBeCalled()
      triggerEvent(el, 'mousedown', e => (e.button = buttonCodes[button]))
      expect(fn).toBeCalled()
    })
  })

  it('should handle multiple arguments when using modifiers', () => {
    const el = document.createElement('div')
    const fn = vi.fn()
    const handler = withModifiers(fn, ['ctrl'])
    const event = triggerEvent(el, 'click', e => (e.ctrlKey = true))
    handler(event, 'value', true)
    expect(fn).toBeCalledWith(event, 'value', true)
  })

  it('withKeys cache wrapped listener separately for different modifiers', () => {
    const el1 = document.createElement('button')
    const el2 = document.createElement('button')
    const fn = vi.fn()
    const handler1 = withKeys(fn, ['a'])
    const handler2 = withKeys(fn, ['b'])
    expect(handler1 === handler2).toBe(false)
    patchEvent(el1, 'onKeyup', null, handler1, null)
    patchEvent(el2, 'onKeyup', null, handler2, null)
    triggerEvent(el1, 'keyup', e => (e.key = 'a'))
    triggerEvent(el2, 'keyup', e => (e.key = 'b'))
    expect(fn).toBeCalledTimes(2)
  })

  it('withModifiers cache wrapped listener separately for different modifiers', () => {
    const el1 = document.createElement('button')
    const el2 = document.createElement('button')
    const fn = vi.fn()
    const handler1 = withModifiers(fn, ['ctrl'])
    const handler2 = withModifiers(fn, ['shift'])
    expect(handler1 === handler2).toBe(false)
    patchEvent(el1, 'onClick', null, handler1, null)
    patchEvent(el2, 'onClick', null, handler2, null)
    triggerEvent(el1, 'click', e => (e.ctrlKey = true))
    triggerEvent(el2, 'click', e => (e.shiftKey = true))
    expect(fn).toBeCalledTimes(2)
  })
})
