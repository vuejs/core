import { watch } from 'vue'
import {
  children,
  on,
  ref,
  render as renderComponent,
  setText,
  template,
  watchEffect, // TODO:
} from '@vue/vapor'

export default {
  props: undefined,

  setup(_, {}) {
    const count = ref(1)
    const handleClick = () => {
      count.value++
    }

    const __returned__ = { count, handleClick }

    Object.defineProperty(__returned__, '__isScriptSetup', {
      enumerable: false,
      value: true,
    })

    return __returned__
  },

  render(_ctx) {
    const t0 = template('<button></button>')
    const n0 = t0()
    const {
      0: [n1],
    } = children(n0)
    on(n1, 'click', _ctx.handleClick)
    watchEffect(() => {
      setText(n1, void 0, _ctx.count)
    })

    // TODO: create component fn?
    // const c0 = createComponent(...)
    // insert(n0, c0)
    renderComponent(
      child,

      // TODO: proxy??
      {
        /* <Comp :count="count" /> */
        get count() {
          return _ctx.count
        },

        /* <Comp :inline-double="count * 2" /> */
        get inlineDouble() {
          return _ctx.count * 2
        },
      },
      n0,
    )

    return n0
  },
}

const child = {
  props: {
    count: { type: Number, default: 1 },
    inlineDouble: { type: Number, default: 2 },
  },

  setup(props) {
    watch(
      () => props.count,
      v => console.log('count changed', v),
    )
    watch(
      () => props.inlineDouble,
      v => console.log('inlineDouble changed', v),
    )

    const __returned__ = {}

    Object.defineProperty(__returned__, '__isScriptSetup', {
      enumerable: false,
      value: true,
    })

    return __returned__
  },

  render(_ctx) {
    const t0 = template('<p></p>')
    const n0 = t0()
    const {
      0: [n1],
    } = children(n0)
    watchEffect(() => {
      setText(n1, void 0, _ctx.count + ' * 2 = ' + _ctx.inlineDouble)
    })
    return n0
  },
}
