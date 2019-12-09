import { generate, parse, transform } from '@vue/compiler-core'
import { transformSrcset } from '../src/templateTransformSrcset'
import { transformElement } from '../../compiler-core/src/transforms/transformElement'
import { transformBind } from '../../compiler-core/src/transforms/vBind'

function compileWithSrcset(template: string) {
  const ast = parse(template)
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
		`)

    expect(result.code).toMatchSnapshot()
  })
})
