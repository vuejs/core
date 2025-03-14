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
      `<Transition><h1 v-show="show">foo</h1></Transition>`,
    )
    expect(code).toMatchSnapshot()
  })

  test('v-show + appear', () => {
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

  function checkWarning(template: string, shouldWarn = true) {
    const onError = vi.fn()
    compileWithElementTransform(template, { onError })
    if (shouldWarn) {
      expect(onError).toHaveBeenCalled()
      expect(onError.mock.calls).toMatchObject([
        [{ code: DOMErrorCodes.X_TRANSITION_INVALID_CHILDREN }],
      ])
    } else {
      expect(onError).not.toHaveBeenCalled()
    }
  }

  test('warns if multiple children', () => {
    checkWarning(
      `<Transition>
        <h1>foo</h1>
        <h2>bar</h2>
      </Transition>`,
      true,
    )
  })

  test('warns with v-for', () => {
    checkWarning(
      `
      <transition>
        <div v-for="i in items">hey</div>
      </transition>
      `,
      true,
    )
  })

  test('warns with multiple v-if + v-for', () => {
    checkWarning(
      `
      <transition>
        <div v-if="a" v-for="i in items">hey</div>
        <div v-else v-for="i in items">hey</div>
      </transition>
      `,
      true,
    )
  })

  test('warns with template v-if', () => {
    checkWarning(
      `
      <transition>
        <template v-if="ok"></template>
      </transition>
      `,
      true,
    )
  })

  test('warns with multiple templates', () => {
    checkWarning(
      `
      <transition>
        <template v-if="a"></template>
        <template v-else></template>
      </transition>
      `,
      true,
    )
  })

  test('warns if multiple children with v-if', () => {
    checkWarning(
      `
      <transition>
        <div v-if="one">hey</div>
        <div v-if="other">hey</div>
      </transition>
      `,
      true,
    )
  })

  test('does not warn with regular element', () => {
    checkWarning(
      `
      <transition>
        <div>hey</div>
      </transition>
      `,
      false,
    )
  })

  test('does not warn with one single v-if', () => {
    checkWarning(
      `
      <transition>
        <div v-if="a">hey</div>
      </transition>
      `,
      false,
    )
  })

  test('does not warn with v-if v-else-if v-else', () => {
    checkWarning(
      `
      <transition>
        <div v-if="a">hey</div>
        <div v-else-if="b">hey</div>
        <div v-else>hey</div>
      </transition>
      `,
      false,
    )
  })

  test('does not warn with v-if v-else', () => {
    checkWarning(
      `
      <transition>
        <div v-if="a">hey</div>
        <div v-else>hey</div>
      </transition>
      `,
      false,
    )
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

  test('the v-if/else-if/else branches in Transition should ignore comments', () => {
    expect(
      compileWithElementTransform(`
    <transition>
      <div v-if="a">hey</div>
      <!-- this should be ignored -->
      <div v-else-if="b">hey</div>
      <!-- this should be ignored -->
      <div v-else>
        <p v-if="c"/>
        <!-- this should not be ignored -->
        <p v-else/>
      </div>
    </transition>
    `).code,
    ).toMatchSnapshot()
  })
})
