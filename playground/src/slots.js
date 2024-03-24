// @ts-check
import {
  children,
  createComponent,
  defineComponent,
  insert,
  on,
  ref,
  renderEffect,
  setText,
  template,
} from '@vue/vapor'

// <template #mySlot="{ message, changeMessage }">
//   <div clas="slotted">
//     <h1>{{ message }}</h1>
//     <button @click="changeMessage">btn parent</button>
//   </div>
// </template>
const t1 = template(
  '<div class="slotted"><h1><!></h1><button>parent btn</button></div>',
)

const Parent = defineComponent({
  vapor: true,
  setup() {
    return (() => {
      /** @type {any} */
      const n0 = createComponent(
        Child,
        {},
        {
          mySlot: ({ message, changeMessage }) => {
            const n1 = t1()
            const n2 = /** @type {any} */ (children(n1, 0))
            const n3 = /** @type {any} */ (children(n1, 1))
            renderEffect(() => setText(n2, message()))
            on(n3, 'click', changeMessage)
            return n1
          },
          // e.g. default slot
          // default: () => {
          //   const n1 = t1()
          //   return n1
          // }
        },
      )
      return n0
    })()
  },
})

const t2 = template(
  '<div class="child-container"><button>child btn</button></div>',
)

const Child = defineComponent({
  vapor: true,
  setup(_, { slots }) {
    const message = ref('Hello World!')
    function changeMessage() {
      message.value += '!'
    }

    return (() => {
      // <div>
      //   <slot name="mySlot" :message="msg" :changeMessage="changeMessage" />
      //   <button @click="changeMessage">button in child</button>
      // </div>
      const n0 = /** @type {any} */ (t2())
      const n1 = /** @type {any} */ (children(n0, 0))
      on(n1, 'click', () => changeMessage)
      const s0 = /** @type {any} */ (
        slots.mySlot?.({
          message: () => message.value,
          changeMessage: () => changeMessage,
        })
      )
      insert(s0, n0, n1)
      return n0
    })()
  },
})

export default Parent
