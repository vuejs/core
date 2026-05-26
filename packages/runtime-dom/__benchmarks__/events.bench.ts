import { bench, describe } from 'vitest'
import { patchProp } from '../src/patchProp'

describe('runtime-dom events', () => {
  const singleEl = document.createElement('button')
  let singleCount = 0
  patchProp(singleEl, 'onClick', null, () => singleCount++)

  const multipleEl = document.createElement('button')
  let multipleCount = 0
  patchProp(multipleEl, 'onClick', null, [
    () => multipleCount++,
    () => multipleCount++,
    () => multipleCount++,
    () => multipleCount++,
  ])

  bench('dispatch click with single handler', () => {
    singleEl.dispatchEvent(new Event('click'))
  })

  bench('dispatch click with multiple handlers', () => {
    multipleEl.dispatchEvent(new Event('click'))
  })
})
