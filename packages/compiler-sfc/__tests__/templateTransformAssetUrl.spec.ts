import { generate, baseParse, transform } from '@vue/compiler-core'
import {
  transformAssetUrl,
  createAssetUrlTransformWithOptions,
  AssetURLOptions,
  normalizeOptions
} from '../src/templateTransformAssetUrl'
import { transformElement } from '../../compiler-core/src/transforms/transformElement'
import { transformBind } from '../../compiler-core/src/transforms/vBind'

function compileWithAssetUrls(template: string, options?: AssetURLOptions) {
  const ast = baseParse(template)
  const t = options
    ? createAssetUrlTransformWithOptions(normalizeOptions(options))
    : transformAssetUrl
  transform(ast, {
    nodeTransforms: [t, transformElement],
    directiveTransforms: {
      bind: transformBind
    }
  })
  return generate(ast, { mode: 'module' })
}

describe('compiler sfc: transform asset url', () => {
  test('transform assetUrls', () => {
    const result = compileWithAssetUrls(`
			<img src="./logo.png"/>
			<img src="~fixtures/logo.png"/>
			<img src="~/fixtures/logo.png"/>
			<img src="http://example.com/fixtures/logo.png"/>
			<img src="/fixtures/logo.png"/>
		`)

    expect(result.code).toMatchSnapshot()
  })

  /**
   * vuejs/component-compiler-utils#22 Support uri fragment in transformed require
   */
  test('support uri fragment', () => {
    const result = compileWithAssetUrls(
      '<use href="~@svg/file.svg#fragment"></use>'
    )

    expect(result.code).toMatchSnapshot()
  })

  /**
   * vuejs/component-compiler-utils#22 Support uri fragment in transformed require
   */
  test('support uri is empty', () => {
    const result = compileWithAssetUrls('<use href="~"></use>')

    expect(result.code).toMatchSnapshot()
  })

  test('with explicit base', () => {
    const { code } = compileWithAssetUrls(
      `<img src="./bar.png"></img>` + // -> /foo/bar.png
      `<img src="~bar.png"></img>` + // -> /foo/bar.png
      `<img src="bar.png"></img>` + // -> bar.png (untouched)
        `<img src="@theme/bar.png"></img>`, // -> @theme/bar.png (untouched)
      {
        base: '/foo'
      }
    )
    expect(code).toMatchSnapshot()
  })

  test('with includeAbsolute: true', () => {
    const { code } = compileWithAssetUrls(
      `<img src="./bar.png"/>` +
        `<img src="/bar.png"/>` +
        `<img src="https://foo.bar/baz.png"/>`,
      {
        includeAbsolute: true
      }
    )
    expect(code).toMatchSnapshot()
  })
})
