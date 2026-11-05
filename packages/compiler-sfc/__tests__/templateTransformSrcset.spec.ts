import {
  type TransformOptions,
  baseParse,
  generate,
  transform,
} from '@vue/compiler-core'
import {
  createSrcsetTransformWithOptions,
  transformSrcset,
} from '../src/template/transformSrcset'
import { transformElement } from '../../compiler-core/src/transforms/transformElement'
import { transformBind } from '../../compiler-core/src/transforms/vBind'
import {
  type AssetURLOptions,
  normalizeOptions,
} from '../src/template/transformAssetUrl'
import { stringifyStatic } from '../../compiler-dom/src/transforms/stringifyStatic'

function compileWithSrcset(
  template: string,
  options?: AssetURLOptions,
  transformOptions?: TransformOptions,
) {
  const ast = baseParse(template)
  const srcsetTransform = options
    ? createSrcsetTransformWithOptions(normalizeOptions(options))
    : transformSrcset
  transform(ast, {
    hoistStatic: true,
    nodeTransforms: [srcsetTransform, transformElement],
    directiveTransforms: {
      bind: transformBind,
    },
    ...transformOptions,
  })
  return generate(ast, { mode: 'module' })
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

  test('transform empty srcset w/ includeAbsolute: true', () => {
    expect(
      compileWithSrcset(`<img srcset=" " />`, {
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

  test.each([
    ['https://cdn.example.com/assets/', 'https://cdn.example.com/assets/'],
    ['http://localhost:3000/assets/', 'http://localhost:3000/assets/'],
    ['https://cdn.example.com', 'https://cdn.example.com/'],
    ['//cdn.example.com/assets/', '//cdn.example.com/assets/'],
    ['//cdn.example.com', '//cdn.example.com/'],
    ['/assets/', '/assets/'],
    ['assets/', 'assets/'],
  ])('should resolve relative srcset URLs against base %s', (base, prefix) => {
    const { code } = compileWithSrcset(
      `<picture>` +
        `<source srcset="./logo.png 1x, ./logo@2x.png 2x" />` +
        `<img srcset="./logo.png 400w, ./logo-large.png 800w" />` +
        `</picture>`,
      { base },
    )

    expect(code).toContain(
      `srcset: "${prefix}logo.png 1x, ${prefix}logo@2x.png 2x"`,
    )
    expect(code).toContain(
      `srcset: "${prefix}logo.png 400w, ${prefix}logo-large.png 800w"`,
    )
    expect(code).not.toContain('import _imports_')
  })

  test.each(['https://cdn.example.com/assets/', '//cdn.example.com/assets/'])(
    'should preserve base %s when srcset also requires imports',
    base => {
      const { code } = compileWithSrcset(
        `<img srcset="./logo.png 1x, @/logo.png 2x, https://other.example.com/logo.png 3x" />`,
        { base, includeAbsolute: true },
      )

      expect(code).toContain(`import _imports_0 from '@/logo.png'`)
      expect(code).not.toContain('import _imports_1')
      expect(code).toContain(`"${base}logo.png" + ' 1x, '`)
      expect(code).toContain(`_imports_0 + ' 2x, '`)
      expect(code).toContain(`"https://other.example.com/logo.png" + ' 3x'`)
    },
  )

  test('should resolve parent paths without losing the base hostname', () => {
    const { code } = compileWithSrcset(
      `<img srcset="../logo.svg?size=2#icon 2x" />`,
      { base: 'https://cdn.example.com/assets/images/' },
    )

    expect(code).toContain(
      `srcset: "https://cdn.example.com/assets/logo.svg?size=2#icon 2x"`,
    )
  })

  test.each([
    [
      'https://cdn.example.com/assets/?token=abc',
      'https://cdn.example.com/assets/',
    ],
    ['https://cdn.example.com?token=abc', 'https://cdn.example.com/'],
    ['//cdn.example.com/assets/?token=abc', '//cdn.example.com/assets/'],
    ['/assets/?token=abc#base', '/assets/'],
    ['assets/?token=abc#base', 'assets/'],
    ['~/assets/#base/path', '~/assets/'],
  ])(
    'should resolve srcset paths independently of base suffix %s',
    (base, prefix) => {
      const { code } = compileWithSrcset(
        `<img srcset="./logo.png 1x, ./large.png?size=2#icon 2x" />`,
        { base },
      )

      // A relative path replaces the base URL's query and fragment.
      expect(code).toContain(
        `srcset: "${prefix}logo.png 1x, ${prefix}large.png?size=2#icon 2x"`,
      )
    },
  )

  test.each([
    '?url=https://other.example/image',
    '#//icon/../view',
    '?url=https://other.example/a/../image#//icon/../view',
    '#icon?url=https://other.example/image',
    '?url=https%3A%2F%2Fother.example%2Fimage#%2Ficon',
    "?url='https://other.example/image'",
  ])('should preserve srcset candidate suffix %s', suffix => {
    const { code } = compileWithSrcset(
      `<img srcset="../logo.svg${suffix} 2x" />`,
      { base: 'https://cdn.example.com/assets/images/' },
    )

    expect(code).toContain(
      `srcset: "https://cdn.example.com/assets/logo.svg${suffix} 2x"`,
    )
  })

  test.each(['https://cdn.example.com/assets/', '/assets/'])(
    'should preserve srcset suffixes alongside imports with base %s',
    base => {
      const suffix = '?url=https://other.example/image#//icon/../view'
      const { code } = compileWithSrcset(
        `<img srcset="./logo.svg${suffix} 1x, @/large.png 2x" />`,
        { base: `${base}?token=abc` },
      )

      expect(code).toContain(`import _imports_0 from '@/large.png'`)
      expect(code).not.toContain('import _imports_1')
      expect(code).toContain(`"${base}logo.svg${suffix}" + ' 1x, '`)
      expect(code).toContain(`_imports_0 + ' 2x'`)
    },
  )

  test('should transform subpath import paths starting with #', () => {
    const code = compileWithSrcset(
      `<img srcset="#src/assets/vue.svg" />` +
        `<img srcset="#/src/assets/vue.svg 2x" />`,
    ).code

    expect(code).toContain(`_imports_0 from '#src/assets/vue.svg'`)
    expect(code).toContain(`_imports_1 from '#/src/assets/vue.svg'`)
    expect(code).toContain(`const _hoisted_1 = _imports_0`)
    expect(code).toContain(`const _hoisted_2 = _imports_1 + ' 2x'`)
  })

  test('should preserve svg fragments in srcset URLs', () => {
    const code = compileWithSrcset(
      `<img srcset="./icons.svg#icon-heart" />` +
        `<img srcset="./icons.svg#icon-star 2x" />`,
    ).code

    expect(code).toContain(`_imports_0 from './icons.svg'`)
    expect(code).toContain(`const _hoisted_1 = _imports_0 + '#icon-heart'`)
    expect(code).toContain(
      `const _hoisted_2 = _imports_0 + '#icon-star' + ' 2x'`,
    )
  })

  test('should not throw for malformed percent-encoding in srcset paths', () => {
    const code = compileWithSrcset(`<img srcset="./foo%.png 2x" />`).code

    expect(code).toContain(`import _imports_0 from './foo%.png'`)
    expect(code).toContain(`const _hoisted_1 = _imports_0 + ' 2x'`)
  })
})
