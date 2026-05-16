import { bench, describe } from 'vitest'
import { patchProp } from '../src/patchProp'

describe('runtime-dom events', () => {
  bench('dispatch click with single handler', () => {
    const el = document.createElement('button')
    let count = 0
    patchProp(el, 'onClick', null, () => count++)
    el.dispatchEvent(new Event('click'))
  })

  bench('dispatch click with multiple handlers', () => {
    const el = document.createElement('button')
    let count = 0
    patchProp(el, 'onClick', null, [
      () => count++,
      () => count++,
      () => count++,
      () => count++,
    ])
    el.dispatchEvent(new Event('click'))
  })
})
