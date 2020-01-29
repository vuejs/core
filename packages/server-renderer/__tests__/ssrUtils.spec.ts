import { escapeHtml, interpolate } from '../src'

test('ssr: escapeHTML', () => {
  expect(escapeHtml(`foo`)).toBe(`foo`)
  expect(escapeHtml(true)).toBe(`true`)
  expect(escapeHtml(false)).toBe(`false`)
  expect(escapeHtml(`a && b`)).toBe(`a &amp;&amp; b`)
  expect(escapeHtml(`"foo"`)).toBe(`&quot;foo&quot;`)
  expect(escapeHtml(`'bar'`)).toBe(`&#39;bar&#39;`)
  expect(escapeHtml(`<div>`)).toBe(`&lt;div&gt;`)
})

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
