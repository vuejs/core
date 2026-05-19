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
    expect(code).toContain(`let p0 = _next(_child(n3), 1)`)
    expect(code).toContain(`const n0 = _child(p0)`)
    expect(code).toContain(`const n1 = _child((p0 = _next(p0, 2)))`)
    expect(code).toContain(`const n2 = _child((p0 = _next(p0, 3)))`)
    expect(code).not.toMatch(/const p\d =/)
    expect(code).not.toMatch(/let p[1-9]\d* =/)
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

  test('inline placeholder when branching access paths share one parent access', () => {
    const { code } = compileWithElementTransform(
      `<div>
        <div>
          <section><span>{{ first }}</span></section>
          <section><span>{{ second }}</span></section>
        </div>
      </div>`,
    )
    expect(code).toMatch(/let p\d = _child\(_child\(n\d\)\)/)
    expect(code).not.toMatch(/let p\d = _child\(n\d\)/)
    expect(code).toMatch(/const n\d = _child\(p\d\)/)
    expect(code).toMatch(/const n\d = _child\(\(p\d = _next\(p\d, 1\)\)\)/)
    expect(code).toMatchSnapshot()
  })

  test('reuse cursor assignment for non-adjacent following access path', () => {
    const { code } = compileWithElementTransform(
      `<div>
        <div><span>{{ first }}</span></div>
        <i></i>
        <div><span>{{ second }}</span></div>
      </div>`,
    )
    const pDecls = code.match(/let p\d =/g) || []
    expect(pDecls).toHaveLength(1)
    expect(code).toMatch(/let p\d = _child\(n\d\)/)
    expect(code).toMatch(/const n\d = _child\(\(p\d = _nthChild\(n\d, 2\)\)\)/)
    expect(code).toMatchSnapshot()
  })

  test('materialize placeholder when inline would duplicate parent access', () => {
    const { code } = compileWithElementTransform(
      `<div>
        <section>
          <div><span>{{ first }}</span></div>
          <i></i>
          <div><span>{{ second }}</span></div>
        </section>
      </div>`,
    )
    expect(code).toMatch(/let p\d = _child\(n\d\)/)
    expect(code).toMatch(/_nthChild\(p\d, 2\)/)
    expect(code).not.toMatch(/_nthChild\(_child\(n\d\), 2\)/)
    expect(code).toMatchSnapshot()
  })

  test('keep nested operation parent as node variable before sibling lookup', () => {
    const { code } = compileWithElementTransform(
      `<div>
        <section><Comp /></section>
        <section><span>{{ msg }}</span></section>
      </div>`,
    )
    expect(code).toContain('const n1 = _child(n3)')
    expect(code).toContain('const n2 = _child(_next(n1, 1))')
    expect(code).toContain('_setInsertionState(n1, null, 0)')
    expect(code).not.toContain('p0 = _next')
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
    expect(code).toMatch(`const n3 = _next(_child(n4), 1)`)
    expect(code).toMatch(`_setInsertionState(n4, n3, 1)`)
    expect(code).toMatchSnapshot()
  })
})
