import { generate, baseParse, transform } from '@vue/compiler-core'
import { transformSrcset } from '../src/templateTransformSrcset'
import { transformElement } from '../../compiler-core/src/transforms/transformElement'
import { transformBind } from '../../compiler-core/src/transforms/vBind'

function compileWithSrcset(template: string) {
  const ast = baseParse(template)
  transform(ast, {
    nodeTransforms: [transformSrcset, transformElement],
    directiveTransforms: {
      bind: transformBind
    }
  })
  return generate(ast, { mode: 'module' })
}

describe('compiler sfc: transform srcset', () => {
  test('transform srcset', () => {
    const result = compileWithSrcset(`
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
		`)

    expect(result.code).toMatchSnapshot()
  })
})
