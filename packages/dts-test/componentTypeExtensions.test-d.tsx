import { defineComponent } from 'vue'
import { expectType } from './utils'

declare module 'vue' {
  interface ComponentCustomOptions {
    test?(n: number): void
  }

  interface ComponentCustomProperties {
    state?: 'stopped' | 'running'
  }

  interface ComponentCustomProps {
    custom?: number
  }
}

export const Custom = defineComponent({
  props: {
    bar: String,
    baz: {
      type: Number,
      required: true
    }
  },

  data: () => ({ counter: 0 }),

  test(n) {
    expectType<number>(n)
  },

  methods: {
    aMethod() {
      this.counter++
      this.state = 'running'
      this.$.appContext.config.globalProperties.state = 'running'

      // @ts-expect-error
      this.notExisting
      // @ts-expect-error
      this.state = 'not valid'
      // @ts-expect-error
      this.$.appContext.config.globalProperties.state = 'not valid'
    }
  }
})

expectType<JSX.Element>(<Custom baz={1} />)
expectType<JSX.Element>(<Custom custom={1} baz={1} />)
expectType<JSX.Element>(<Custom bar="bar" baz={1} />)
expectType<JSX.Element>(<Custom ref={''} bar="bar" baz={1} />)

// @ts-expect-error
expectType<JSX.Element>(<Custom />)
// @ts-expect-error
;<Custom bar="bar" />
// @ts-expect-error
;<Custom baz="baz" />
// @ts-expect-error
;<Custom baz={1} notExist={1} />
// @ts-expect-error
;<Custom baz={1} custom="custom" />
