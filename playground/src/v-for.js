import { defineComponent, withKeys } from 'vue'
import { append, createFor, on, ref, renderEffect } from 'vue/vapor'

export default defineComponent({
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
        block => {
          const node = document.createTextNode('')
          const container = document.createElement('li')
          append(container, node)

          const update = () => {
            const [item, index] = block.s
            node.textContent = `${index}. ${item}`
          }
          renderEffect(update)
          return [container, update]
        },
        (item, index) => index,
      )
      const container = document.createElement('ul')
      append(container, li)

      const input = document.createElement('input')
      on(input, 'input', e => {
        value.value = e.target.value
      })
      on(input, 'keydown', withKeys(handleAdd, ['enter']))

      const add = document.createElement('button')
      add.textContent = 'add'
      on(add, 'click', handleAdd)
      renderEffect(() => {
        input.value = value.value
      })

      const del = document.createElement('button')
      del.textContent = 'shift'
      on(del, 'click', handleRemove)

      const data = document.createElement('p')
      renderEffect(() => {
        data.textContent = JSON.stringify(list.value)
      })

      return [container, input, add, del, data]
    })()
  },
})
