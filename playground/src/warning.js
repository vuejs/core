import { createComponent, warn } from 'vue/vapor'

export default {
  vapor: true,
  setup() {
    return createComponent(Comp, [
      {
        msg: () => 'hello',
        onClick: () => () => {},
      },
      () => ({ foo: 'world', msg: 'msg' }),
    ])
  },
}

const Comp = {
  name: 'Comp',
  vapor: true,
  props: ['msg', 'foo'],
  setup() {
    warn('hello')
  },
}
