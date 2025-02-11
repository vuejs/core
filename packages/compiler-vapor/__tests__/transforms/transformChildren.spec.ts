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

  test('efficient traversal', () => {
    const { code } = compileWithElementTransform(
      `<div>
    <div>x</div>
    <div><span>{{ msg }}</span></div>
    <div><span>{{ msg }}</span></div>
    <div><span>{{ msg }}</span></div>
  </div>`,
    )
    expect(code).toMatchSnapshot()
  })

  test('efficient find', () => {
    const { code } = compileWithElementTransform(
      `<div>
        <div>x</div>
        <div>x</div>
        <div>x</div>
        <div>x</div>
        <div>x</div>
        <div>{{ msg }}</div>
      </div>`,
    )
    expect(code).contains(`const n0 = _children(n1, 5)`)
    expect(code).toMatchSnapshot()
  })
})
