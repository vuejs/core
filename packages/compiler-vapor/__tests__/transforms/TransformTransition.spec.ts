import { makeCompile } from './_utils'
import {
  transformChildren,
  transformElement,
  transformText,
  transformVBind,
  transformVIf,
  transformVSlot,
} from '@vue/compiler-vapor'
import { expect } from 'vitest'

const compileWithElementTransform = makeCompile({
  nodeTransforms: [
    transformText,
    transformVIf,
    transformElement,
    transformVSlot,
    transformChildren,
  ],
  directiveTransforms: {
    bind: transformVBind,
  },
})

describe('compiler: transition', () => {
  test('basic', () => {
    const { code } = compileWithElementTransform(
      `<Transition appear><h1 v-show="show">foo</h1></Transition>`,
    )
    expect(code).toMatchSnapshot()
  })

  test('work with v-if', () => {
    const { code } = compileWithElementTransform(
      `<Transition><h1 v-if="show">foo</h1></Transition>`,
    )

    expect(code).toMatchSnapshot()
    // n2 should have a key
    expect(code).contains('n2.$key = 2')
  })

  test('work with dynamic keyed children', () => {
    const { code } = compileWithElementTransform(
      `<Transition>
        <h1 :key="key">foo</h1>
      </Transition>`,
    )

    expect(code).toMatchSnapshot()
    expect(code).contains('_createKeyedFragment(() => _ctx.key')
    // should preserve key
    expect(code).contains('n0.$key = _ctx.key')
  })
})
