import { compile } from '../../src'

describe('compiler warnings', () => {
  describe('Transition', () => {
    function checkWarning(
      template: string,
      shouldWarn: boolean,
      message = `<Transition> expects exactly one child element or component.`
    ) {
      const spy = jest.fn()
      compile(template.trim(), {
        hoistStatic: true,
        transformHoist: null,
        onError: err => {
          spy(err.message)
        }
      })

      if (shouldWarn) expect(spy).toHaveBeenCalledWith(message)
      else expect(spy).not.toHaveBeenCalled()
    }

    test('warns if multiple children', () => {
      checkWarning(
        `
      <transition>
        <div>hey</div>
        <div>hey</div>
      </transition>
      `,
        true
      )
    })

    test('warns with v-for', () => {
      checkWarning(
        `
      <transition>
        <div v-for="i in items">hey</div>
      </transition>
      `,
        true
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
        true
      )
    })

    test('warns with template v-if', () => {
      checkWarning(
        `
      <transition>
        <template v-if="ok"></template>
      </transition>
      `,
        true
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
        true
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
        true
      )
    })

    test('does not warn with regular element', () => {
      checkWarning(
        `
      <transition>
        <div>hey</div>
      </transition>
      `,
        false
      )
    })

    test('does not warn with one single v-if', () => {
      checkWarning(
        `
      <transition>
        <div v-if="a">hey</div>
      </transition>
      `,
        false
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
        false
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
        false
      )
    })
  })
})

test('the v-if/else-if/else branches in Transition should ignore comments', () => {
  expect(
    compile(`
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
    `).code
  ).toMatchSnapshot()
})
