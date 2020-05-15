import { expectError, expectType } from 'tsd'
import { defineComponent } from './index'

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
      expectError(this.notExisting)
      this.counter++
      this.state = 'running'
      expectError((this.state = 'not valid'))
    }
  }
})
