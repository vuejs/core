import { makeCompile } from './_utils'
import {
  transformChildren,
  transformElement,
  transformText,
  transformVIf,
} from '../../src'

const compileWithElementTransform = makeCompile({
  nodeTransforms: [
    transformText,
    transformVIf,
    transformElement,
    transformChildren,
  ],
})

describe('compiler: children transform', () => {
  test.todo('basic')

  test('children & sibling references', () => {
    const { code, helpers } = compileWithElementTransform(
      `<div>
        <p>{{ first }}</p>
        {{ second }}
        {{ third }}
        <p>{{ forth }}</p>
      </div>`,
    )
    expect(code).toMatchSnapshot()
    expect(Array.from(helpers)).containSubset([
      'next',
      'setText',
      'createTextNode',
      'insert',
      'template',
    ])
  })
})
