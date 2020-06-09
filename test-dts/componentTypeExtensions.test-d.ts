import { defineComponent, expectError, expectType } from './index'

declare module '@vue/runtime-core' {
  interface ComponentCustomOptions {
    test?(n: number): void
  }

  interface ComponentCustomProperties {
    state: 'stopped' | 'running'
  }
}

export const Custom = defineComponent({
  data: () => ({ counter: 0 }),

  test(n) {
    expectType<number>(n)
  },

  methods: {
    aMethod() {
      // @ts-expect-error
      expectError(this.notExisting)
      this.counter++
      this.state = 'running'
      // @ts-expect-error
      expectError((this.state = 'not valid'))
    }
  }
})
