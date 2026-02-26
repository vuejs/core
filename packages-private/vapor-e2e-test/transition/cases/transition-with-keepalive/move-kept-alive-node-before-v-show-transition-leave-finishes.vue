<script setup vapor>
import {
  applyVShow,
  child,
  createComponent,
  defineVaporComponent,
  delegateEvents,
  ref,
  renderEffect,
  setElementText,
  setText,
  template,
  toDisplayString,
  txt,
  VaporTransition,
} from 'vue'

const show2 = ref(true)
const state = ref(1)

const Item = defineVaporComponent({
  name: 'Item',
  setup() {
    return createComponent(
      VaporTransition,
      { name: () => 'test', persisted: () => '' },
      {
        default: () => {
          const n1 = template('<div><h2> </h2></div>')()
          const n0 = child(n1)
          const x0 = txt(n0)
          applyVShow(n1, () => show2.value)
          renderEffect(() =>
            setText(
              x0,
              toDisplayString(
                show2.value ? 'I should show' : "I shouldn't show ",
              ),
            ),
          )
          return n1
        },
      },
    )
  },
})

const Comp1 = defineVaporComponent({
  name: 'Comp1',
  setup() {
    delegateEvents('click')
    const n0 = createComponent(Item)
    const n1 = template('<h2>This is page1</h2>')()
    const n2 = template('<button id="changeShowBtn"></button>')()
    n2.$evtclick = () => (show2.value = !show2.value)
    renderEffect(() => {
      setElementText(n2, show2.value)
    })
    return [n0, n1, n2]
  },
})

const Comp2 = defineVaporComponent({
  name: 'Comp2',
  setup() {
    return template('<h2>This is page2</h2>')()
  },
})
</script>

<template>
  <div class="keep-alive-move-before-leave-finishes">
    <div>
      <KeepAlive :include="['Comp1', 'Comp2']">
        <component :is="state === 1 ? Comp1 : Comp2" />
      </KeepAlive>
    </div>
    <button @click="state = state === 1 ? 2 : 1">button</button>
  </div>
</template>
