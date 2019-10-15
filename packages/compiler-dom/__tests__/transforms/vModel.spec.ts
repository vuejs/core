import { parse, transform, CompilerOptions } from '@vue/compiler-core'
import { transformModel } from '../../src/transforms/vModel'
import { transformElement } from '../../../compiler-core/src/transforms/transformElement'
import { DOMErrorCodes } from '../../src/errors'

function transformWithModel(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformElement],
    directiveTransforms: {
      model: transformModel
    },
    ...options
  })
  return ast
}
describe('compiler: v-model transform', () => {
  it('should raise error if used in not support input element type', () => {
    const onError = jest.fn()
    transformWithModel(`<input type="image" v-model="test"></input>`, {
      onError
    })
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_MODEL_ON_INVALID_INPUT_ELEMENT_TYPE }]
    ])
  })
})
