import type { TransformOptions } from '@vue/compiler-core'
import type { AssetURLOptions } from '../../../compiler-sfc/src/template/transformAssetUrl'
import { compileTemplate } from '../../../compiler-sfc/src/compileTemplate'
import { stringifyStatic } from '../../../compiler-dom/src/transforms/stringifyStatic'

function compileWithSrcset(
  template: string,
  options?: AssetURLOptions,
  transformOptions?: TransformOptions,
) {
  return compileTemplate({
    vapor: true,
    id: 'test',
    filename: 'test.vue',
    source: template,
    transformAssetUrls: {
      includeAbsolute: true,
      ...options,
    },
  })
}

const src = `
<img src="./logo.png" srcset=""/>
<img src="./logo.png" srcset="./logo.png"/>
<img src="./logo.png" srcset="./logo.png 2x"/>
<img src="./logo.png" srcset="./logo.png 2x"/>
<img src="./logo.png" srcset="./logo.png, ./logo.png 2x"/>
<img src="./logo.png" srcset="./logo.png 2x, ./logo.png"/>
<img src="./logo.png" srcset="./logo.png 2x, ./logo.png 3x"/>
<img src="./logo.png" srcset="./logo.png, ./logo.png 2x, ./logo.png 3x"/>
<img src="/logo.png" srcset="/logo.png, /logo.png 2x"/>
<img src="https://example.com/logo.png" srcset="https://example.com/logo.png, https://example.com/logo.png 2x"/>
<img src="/logo.png" srcset="/logo.png, ./logo.png 2x"/>
<img src="data:image/png;base64,i" srcset="data:image/png;base64,i 1x, data:image/png;base64,i 2x"/>
`

describe('compiler sfc: transform srcset', () => {
  test('transform srcset', () => {
    expect(compileWithSrcset(src).code).toMatchSnapshot()
  })

  test('transform srcset w/ base', () => {
    expect(
      compileWithSrcset(src, {
        base: '/foo',
      }).code,
    ).toMatchSnapshot()
  })

  test('transform srcset w/ includeAbsolute: true', () => {
    expect(
      compileWithSrcset(src, {
        includeAbsolute: true,
      }).code,
    ).toMatchSnapshot()
  })

  test('transform srcset w/ stringify', () => {
    const code = compileWithSrcset(
      `<div>${src}</div>`,
      {
        includeAbsolute: true,
      },
      {
        hoistStatic: true,
        transformHoist: stringifyStatic,
      },
    ).code
    expect(code).toMatch(`_createStaticVNode`)
    expect(code).toMatchSnapshot()
  })

  test('srcset w/ explicit base option', () => {
    const code = compileWithSrcset(
      `
      <img srcset="@/logo.png, @/logo.png 2x"/>
      <img srcset="@/logo.png 1x, ./logo.png 2x"/>
    `,
      { base: '/foo/' },
      { hoistStatic: true },
    ).code
    expect(code).toMatchSnapshot()
  })
})
