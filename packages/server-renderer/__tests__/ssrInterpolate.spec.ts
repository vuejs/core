import { ssrInterpolate } from '../src/helpers/ssrInterpolate'
import { escapeHtml } from '@vue/shared'

test('ssr: interpolate', () => {
  expect(ssrInterpolate(0)).toBe(`0`)
  expect(ssrInterpolate(`foo`)).toBe(`foo`)
  expect(ssrInterpolate(`<div>`)).toBe(`&lt;div&gt;`)
  // should escape interpolated values
  expect(ssrInterpolate([1, 2, 3])).toBe(
    escapeHtml(JSON.stringify([1, 2, 3], null, 2)),
  )
  expect(
    ssrInterpolate({
      foo: 1,
      bar: `<div>`,
    }),
  ).toBe(
    escapeHtml(
      JSON.stringify(
        {
          foo: 1,
          bar: `<div>`,
        },
        null,
        2,
      ),
    ),
  )
})
