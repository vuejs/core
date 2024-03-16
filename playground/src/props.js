// @ts-check
import {
  createComponent,
  defineComponent,
  on,
  reactive,
  ref,
  renderEffect,
  setText,
  template,
} from '@vue/vapor'

const t0 = template('<button></button>')

export default defineComponent({
  vapor: true,
  setup() {
    const count = ref(1)
    const props = reactive({
      a: 'b',
      'foo-bar': 100,
    })
    const handleClick = () => {
      count.value++
      props['foo-bar']++
      // @ts-expect-error
      props.boolean = true
      console.log(count)
    }

    return (() => {
      const n0 = /** @type {HTMLButtonElement} */ (t0())
      on(n0, 'click', () => handleClick)
      renderEffect(() => setText(n0, count.value))
      /** @type {any} */
      const n1 = createComponent(child, [
        {
          /* <Comp :count="count" /> */
          count: () => {
            // console.trace('access')
            return count.value
          },
          /* <Comp :inline-double="count * 2" /> */
          inlineDouble: () => count.value * 2,
          id: () => 'hello',
        },
        () => props,
      ])
      return [n0, n1]
    })()
  },
})

const t1 = template('<p></p>')
const child = defineComponent({
  vapor: true,

  props: {
    count: { type: Number, default: 1 },
    inlineDouble: { type: Number, default: 2 },
    fooBar: { type: Number, required: true },
    boolean: { type: Boolean },
  },

  setup(props, { attrs }) {
    console.log(props, { ...props })
    console.log(attrs, { ...attrs })

    return (() => {
      const n0 = /** @type {HTMLParagraphElement} */ (t1())
      renderEffect(() =>
        setText(n0, props.count + ' * 2 = ' + props.inlineDouble),
      )
      const n1 = /** @type {HTMLParagraphElement} */ (t1())
      renderEffect(() => setText(n1, props.fooBar, ', ', props.boolean))
      return [n0, n1]
    })()
  },
})
