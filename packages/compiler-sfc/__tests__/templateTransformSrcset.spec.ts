import { generate, baseParse, transform } from '@vue/compiler-core'
import {
  transformSrcset,
  createSrcsetTransformWithOptions
} from '../src/templateTransformSrcset'
import { transformElement } from '../../compiler-core/src/transforms/transformElement'
import { transformBind } from '../../compiler-core/src/transforms/vBind'
import {
  AssetURLOptions,
  normalizeOptions
} from '../src/templateTransformAssetUrl'

function compileWithSrcset(template: string, options?: AssetURLOptions) {
  const ast = baseParse(template)
  const srcsetTrasnform = options
    ? createSrcsetTransformWithOptions(normalizeOptions(options))
    : transformSrcset
  transform(ast, {
    nodeTransforms: [srcsetTrasnform, transformElement],
    directiveTransforms: {
      bind: transformBind
    }
  })
  return generate(ast, { mode: 'module' })
}

const src = `
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
`

describe('compiler sfc: transform srcset', () => {
  test('transform srcset', () => {
    expect(compileWithSrcset(src).code).toMatchSnapshot()
  })

  test('transform srcset w/ base', () => {
    expect(
      compileWithSrcset(src, {
        base: '/foo'
      }).code
    ).toMatchSnapshot()
  })

  test('transform srcset w/ includeAbsolute: true', () => {
    expect(
      compileWithSrcset(src, {
        includeAbsolute: true
      }).code
    ).toMatchSnapshot()
  })
})
