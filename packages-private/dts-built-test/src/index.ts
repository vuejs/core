import { defineComponent } from 'vue'

const _CustomPropsNotErased = defineComponent({
  props: {},
  setup() {},
})

// #8376
export const CustomPropsNotErased =
  _CustomPropsNotErased as typeof _CustomPropsNotErased & {
    foo: string
  }
