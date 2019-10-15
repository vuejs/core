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
  it('should raise error if used file input element', () => {
    const onError = jest.fn()
    transformWithModel(`<input type="file" v-model="test"></input>`, {
      onError
    })
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_MODEL_ON_FILE_INPUT_ELEMENT }]
    ])
  })
})
