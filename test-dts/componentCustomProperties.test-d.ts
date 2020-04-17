import { expectError } from 'tsd'
import { defineComponent } from './index'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    state: 'stopped' | 'running'
  }
}

export const Custom = defineComponent({
  data: () => ({ counter: 0 }),
  methods: {
    aMethod() {
      expectError(this.notExisting)
      this.counter++
      this.state = 'running'
      expectError((this.state = 'not valid'))
    }
  }
})
