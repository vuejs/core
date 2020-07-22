import { rewriteDefault } from '../src'

describe('compiler sfc: rewriteDefault', () => {
  test('without export default', () => {
    expect(rewriteDefault(`export  a = {}`, 'script')).toMatchInlineSnapshot(`
      "export  a = {}
      const script = {}"
    `)
  })

  test('rewrite export default', () => {
    expect(
      rewriteDefault(`export  default {}`, 'script')
    ).toMatchInlineSnapshot(`"const script = {}"`)
  })

  test('rewrite export named default', () => {
    expect(
      rewriteDefault(
        `const a = 1 \n export { a as b, a as default, a as c}`,
        'script'
      )
    ).toMatchInlineSnapshot(`
      "const a = 1 
       export { a as b,  a as c}
      const script = a"
    `)
  })
})
