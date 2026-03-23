import type { TransformOptions } from '@vue/compiler-core'
import type { AssetURLOptions } from '../../../compiler-sfc/src/template/transformAssetUrl'
import { stringifyStatic } from '../../../compiler-dom/src/transforms/stringifyStatic'
import { compileTemplate } from '../../../compiler-sfc/src'

function compileWithAssetUrls(
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

describe('compiler sfc: transform asset url', () => {
  test('transform assetUrls', () => {
    const result = compileWithAssetUrls(`
			<img src="./logo.png"/>
			<img src="~fixtures/logo.png"/>
			<img src="~/fixtures/logo.png"/>
			<img src="http://example.com/fixtures/logo.png"/>
			<img src="//example.com/fixtures/logo.png"/>
			<img src="/fixtures/logo.png"/>
			<img src="data:image/png;base64,i"/>
		`)

    expect(result.code).toMatchSnapshot()
  })

  /**
   * vuejs/component-compiler-utils#22 Support uri fragment in transformed require
   */
  test('support uri fragment', () => {
    const result = compileWithAssetUrls(
      '<use href="~@svg/file.svg#fragment"></use>' +
        '<use href="~@svg/file.svg#fragment"></use>',
      {},
      {
        hoistStatic: true,
      },
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
        `<img src="bar.png"></img>` + // -> bar.png (untouched)
        `<img src="~bar.png"></img>` + // -> still converts to import
        `<img src="@theme/bar.png"></img>`, // -> still converts to import
      {
        base: '/foo',
      },
    )
    expect(code).toMatch(`import _imports_0 from 'bar.png'`)
    expect(code).toMatch(`import _imports_1 from '@theme/bar.png'`)
    expect(code).toMatchSnapshot()
  })

  test('with includeAbsolute: true', () => {
    const { code } = compileWithAssetUrls(
      `<img src="./bar.png"/>` +
        `<img src="/bar.png"/>` +
        `<img src="https://foo.bar/baz.png"/>` +
        `<img src="//foo.bar/baz.png"/>`,
      {
        includeAbsolute: true,
      },
    )
    expect(code).toMatchSnapshot()
  })

  // vitejs/vite#298
  test('should not transform hash fragments', () => {
    const { code } = compileWithAssetUrls(
      `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
          <circle id="myCircle" cx="0" cy="0" r="5" />
        </defs>
        <use x="5" y="5" xlink:href="#myCircle" />
      </svg>`,
    )
    // should not remove it
    expect(code).toMatch(`xlink:href=#myCircle`) // compiled to template string, not object, so remove quotes
  })

  test('should allow for full base URLs, with paths', () => {
    const { code } = compileWithAssetUrls(`<img src="./logo.png" />`, {
      base: 'http://localhost:3000/src/',
    })

    expect(code).toMatchSnapshot()
  })

  test('should allow for full base URLs, without paths', () => {
    const { code } = compileWithAssetUrls(`<img src="./logo.png" />`, {
      base: 'http://localhost:3000',
    })

    expect(code).toMatchSnapshot()
  })

  test('should allow for full base URLs, without port', () => {
    const { code } = compileWithAssetUrls(`<img src="./logo.png" />`, {
      base: 'http://localhost',
    })

    expect(code).toMatchSnapshot()
  })

  test('should allow for full base URLs, without protocol', () => {
    const { code } = compileWithAssetUrls(`<img src="./logo.png" />`, {
      base: '//localhost',
    })

    expect(code).toMatchSnapshot()
  })

  test('transform with stringify', () => {
    const { code } = compileWithAssetUrls(
      `<div>` +
        `<img src="./bar.png"/>` +
        `<img src="/bar.png"/>` +
        `<img src="https://foo.bar/baz.png"/>` +
        `<img src="//foo.bar/baz.png"/>` +
        `<img src="./bar.png"/>` +
        `</div>`,
      {
        includeAbsolute: true,
      },
      {
        hoistStatic: true,
        transformHoist: stringifyStatic,
      },
    )
    expect(code).toMatchSnapshot()
  })

  test('transform with stringify with space in absolute filename', () => {
    const { code } = compileWithAssetUrls(
      `<div><img src="/foo bar.png"/></div>`,
      {
        includeAbsolute: true,
      },
      {
        hoistStatic: true,
        transformHoist: stringifyStatic,
      },
    )
    expect(code).toContain(`import _imports_0 from '/foo bar.png'`)
  })

  test('transform with stringify with space in relative filename', () => {
    const { code } = compileWithAssetUrls(
      `<div><img src="./foo bar.png"/></div>`,
      {
        includeAbsolute: true,
      },
      {
        hoistStatic: true,
        transformHoist: stringifyStatic,
      },
    )
    expect(code).toContain(`import _imports_0 from './foo bar.png'`)
  })
})
