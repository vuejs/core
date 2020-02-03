import { interpolate } from '../src/helpers/interpolate'
import { escapeHtml } from '@vue/shared'

test('ssr: interpolate', () => {
  expect(interpolate(0)).toBe(`0`)
  expect(interpolate(`foo`)).toBe(`foo`)
  expect(interpolate(`<div>`)).toBe(`&lt;div&gt;`)
  // should escape interpolated values
  expect(interpolate([1, 2, 3])).toBe(
    escapeHtml(JSON.stringify([1, 2, 3], null, 2))
  )
  expect(
    interpolate({
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
