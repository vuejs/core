import { makeCompile } from './_utils'
import {
  transformChildren,
  transformElement,
  transformText,
  transformVBind,
  transformVIf,
  transformVShow,
  transformVSlot,
} from '@vue/compiler-vapor'
import { transformTransition } from '../../src/transforms/transformTransition'
import { DOMErrorCodes } from '@vue/compiler-dom'

const compileWithElementTransform = makeCompile({
  nodeTransforms: [
    transformText,
    transformVIf,
    transformElement,
    transformVSlot,
    transformChildren,
    transformTransition,
  ],
  directiveTransforms: {
    bind: transformVBind,
    show: transformVShow,
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

  test('warns if multiple children', () => {
    const onError = vi.fn()
    compileWithElementTransform(
      `<Transition>
        <h1>foo</h1>
        <h2>bar</h2>
      </Transition>`,
      {
        onError,
      },
    )
    expect(onError).toHaveBeenCalled()
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_TRANSITION_INVALID_CHILDREN }],
    ])
  })

  test('inject persisted when child has v-show', () => {
    expect(
      compileWithElementTransform(`
        <Transition>
          <div v-show="ok" />
        </Transition>
    `).code,
    ).toMatchSnapshot()
  })

  // TODO more tests
})
