import { type DefineComponent, type Directive, defineComponent } from 'vue'
import { expectType } from './utils'

declare module 'vue' {
  interface ComponentCustomOptions {
    test?(n: number): void
  }

  interface GlobalDirectives {
    test: Directive
  }

  interface GlobalComponents {
    RouterView: DefineComponent<{}>
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
      required: true,
    },
  },

  data: () => ({ counter: 0 }),

  test(n) {
    expectType(n, {} as number)
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
    },
  },
})

expectType(Custom.directives!.test, {} as Directive)
expectType(Custom.components!.RouterView, {} as DefineComponent<{}>)
expectType(<Custom baz={1} />, {} as JSX.Element)
expectType(<Custom custom={1} baz={1} />, {} as JSX.Element)
expectType(<Custom bar="bar" baz={1} />, {} as JSX.Element)
expectType(<Custom ref={''} bar="bar" baz={1} />, {} as JSX.Element)

// @ts-expect-error
expectType(<Custom />, {} as JSX.Element)
// @ts-expect-error
;<Custom bar="bar" />
// @ts-expect-error
;<Custom baz="baz" />
// @ts-expect-error
;<Custom baz={1} notExist={1} />
// @ts-expect-error
;<Custom baz={1} custom="custom" />
