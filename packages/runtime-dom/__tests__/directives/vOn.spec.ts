import { patchEvent } from '../../src/modules/events'
import { vOnModifiersGuard } from '@vue/runtime-dom'

function triggerEvent(
  target: Element,
  event: string,
  process?: (e: any) => any
) {
  const e = document.createEvent('HTMLEvents')
  e.initEvent(event, true, true)
  if (event === 'click') {
    ;(e as any).button = 0
  }
  if (process) process(e)
  target.dispatchEvent(e)
  return e
}

describe('runtime-dom: v-on directive', () => {
  test('it should support stop and prevent', async () => {
    const parent = document.createElement('div')
    const child = document.createElement('input')
    parent.appendChild(child)
    const childNextValue = {
      handler: vOnModifiersGuard(jest.fn(), ['prevent', 'stop']),
      options: {}
    }
    patchEvent(child, 'click', null, childNextValue, null)
    const parentHandler = jest.fn()
    const parentNextValue = { handler: parentHandler, options: {} }
    patchEvent(parent, 'click', null, parentNextValue, null)
    expect(triggerEvent(child, 'click').defaultPrevented).toBe(true)
    expect(parentHandler).not.toBeCalled()
  })

  test('it should support key modifiers and system modifiers', () => {
    const el = document.createElement('div')
    const fn = jest.fn()
    const nextValue = {
      handler: vOnModifiersGuard(fn, ['ctrl', 'esc']),
      options: {}
    }
    patchEvent(el, 'click', null, nextValue, null)
    triggerEvent(el, 'click', e => {
      e.ctrlKey = false
      e.key = 'esc'
    })
    expect(fn).not.toBeCalled()
    triggerEvent(el, 'click', e => {
      e.ctrlKey = true
      e.key = 'Escape'
    })
    expect(fn).toBeCalled()
  })

  test('it should support "exact" modifier', () => {})
})
