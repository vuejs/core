import { defineComponent } from '@vue/runtime-dom'

export const Comp = defineComponent({})

export const FuncComp = defineComponent((props: { a: string }) => {})

export const PropsComp = defineComponent({
  props: {
    a: String
  },

  setup(props, ctx) {
    return {
      pa: props.a
    }
  }
})

export const PropNamesComp = defineComponent({
  props: ['a'],
  setup(props, ctx) {
    return {
      pa: props.a
    }
  }
})
