// @ts-check
import {
  children,
  defineComponent,
  on,
  ref,
  render as renderComponent,
  setText,
  template,
  watch,
  watchEffect,
} from '@vue/vapor'

const t0 = template('<button></button>')

export default defineComponent({
  vapor: true,
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
    const n0 = t0()
    const n1 = /** @type {HTMLButtonElement} */ (children(n0, 0))
    on(n1, 'click', () => _ctx.handleClick)
    watchEffect(() => {
      setText(n1, _ctx.count)
    })

    // TODO: create component fn?
    // const c0 = createComponent(...)
    // insert(n0, c0)
    renderComponent(
      /** @type {any} */ (child),

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
      // @ts-expect-error TODO
      n0[0],
    )

    return n0
  },
})

const t1 = template('<p></p>')
const child = defineComponent({
  vapor: true,

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
  },

  render(_ctx) {
    const n0 = t1()
    const n1 = children(n0, 0)
    watchEffect(() => {
      setText(n1, void 0, _ctx.count + ' * 2 = ' + _ctx.inlineDouble)
    })
    return n0
  },
})
