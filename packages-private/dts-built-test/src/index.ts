import { defineComponent, defineProps } from 'vue'

const _CustomPropsNotErased = defineComponent({
  props: {},
  setup() {},
})

// #8376
export const CustomPropsNotErased =
  _CustomPropsNotErased as typeof _CustomPropsNotErased & {
    foo: string
  }

export function genericProps<T>() {
  return defineProps<{
    active?: boolean
    options: readonly { value: T }[]
    value: T
  }>()
}
