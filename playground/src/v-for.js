// @ts-check
import {
  createFor,
  defineComponent,
  insert,
  on,
  ref,
  renderEffect,
} from 'vue/vapor'

export default defineComponent({
  vapor: true,
  setup() {
    const list = ref(['a', 'b', 'c'])
    const value = ref('')

    function handleAdd() {
      list.value.push(value.value)
      value.value = ''
    }

    function handleRemove() {
      list.value.shift()
    }

    return (() => {
      const li = createFor(
        () => list.value,
        ctx0 => {
          const node = document.createTextNode('')
          const container = document.createElement('li')
          insert(node, container)

          renderEffect(() => {
            const [item, index] = ctx0
            node.textContent = `${index}. ${item}`
          })
          return container
        },
        (item, index) => index,
      )
      const container = document.createElement('ul')
      insert(li, container)

      const input = document.createElement('input')
      on(input, 'input', () => e => {
        value.value = e.target.value
      })
      on(input, 'keydown', () => handleAdd, {
        keys: ['enter'],
      })

      const add = document.createElement('button')
      add.textContent = 'add'
      on(add, 'click', () => handleAdd)
      renderEffect(() => {
        input.value = value.value
      })

      const del = document.createElement('button')
      del.textContent = 'shift'
      on(del, 'click', () => handleRemove)

      const data = document.createElement('p')
      renderEffect(() => {
        data.textContent = JSON.stringify(list.value)
      })

      return [container, input, add, del, data]
    })()
  },
})
