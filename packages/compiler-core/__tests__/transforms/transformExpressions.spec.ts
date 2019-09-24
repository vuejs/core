import { compile } from '../../src'

test(`should work`, () => {
  const { code } = compile(`<div>{{ foo }} bar</div>`, {
    prefixIdentifiers: true
  })
  expect(code).toContain(`foo`)
})
