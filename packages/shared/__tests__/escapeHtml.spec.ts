import { escapeHtml } from '../src'

test('ssr: escapeHTML', () => {
  expect(escapeHtml(`foo`)).toBe(`foo`)
  expect(escapeHtml(true)).toBe(`true`)
  expect(escapeHtml(false)).toBe(`false`)
  expect(escapeHtml(`a && b`)).toBe(`a &amp;&amp; b`)
  expect(escapeHtml(`"foo"`)).toBe(`&quot;foo&quot;`)
  expect(escapeHtml(`'bar'`)).toBe(`&#39;bar&#39;`)
  expect(escapeHtml(`<div>`)).toBe(`&lt;div&gt;`)
})
