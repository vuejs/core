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
      'child',
      'toDisplayString',
      'renderEffect',
      'next',
      'setText',
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
        <div>{{ msg }}</div>
      </div>`,
    )
    expect(code).contains(`const n0 = _nthChild(n1, 2)`)
    expect(code).toMatchSnapshot()
  })

  test('anchor insertion in middle', () => {
    const { code } = compileWithElementTransform(
      `<div>
        <div></div>
        <div v-if="1"></div>
        <div></div>
      </div>`,
    )
    // ensure the insertion anchor is generated before the insertion statement
    expect(code).toMatch(`const n3 = _next(_child(n4))`)
    expect(code).toMatch(`_setInsertionState(n4, n3)`)
    expect(code).toMatchSnapshot()
  })
})
