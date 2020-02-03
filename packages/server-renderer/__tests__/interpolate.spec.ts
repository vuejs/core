import { _interpolate } from '../src'
import { escapeHtml } from '@vue/shared'

test('ssr: interpolate', () => {
  expect(_interpolate(0)).toBe(`0`)
  expect(_interpolate(`foo`)).toBe(`foo`)
  expect(_interpolate(`<div>`)).toBe(`&lt;div&gt;`)
  // should escape interpolated values
  expect(_interpolate([1, 2, 3])).toBe(
    escapeHtml(JSON.stringify([1, 2, 3], null, 2))
  )
  expect(
    _interpolate({
      foo: 1,
      bar: `<div>`
    })
  ).toBe(
    escapeHtml(
      JSON.stringify(
        {
          foo: 1,
          bar: `<div>`
        },
        null,
        2
      )
    )
  )
})
