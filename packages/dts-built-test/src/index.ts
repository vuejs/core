import { type PropType, defineComponent } from 'vue'

const _CustomPropsNotErased = defineComponent({
  props: {},
  setup() {},
})

export const RegularComponent = defineComponent({
  props: {
    // a: String
  },
  setup(props) {
    return () => {}
  },
})

type MyInterface =
  | {
      a: string
    }
  | { b: string }
export const RegularComponentProps = defineComponent({
  props: {
    a: Object as () => MyInterface,
    b: Object as PropType<MyInterface>,
  },
  setup(props) {
    return () => {}
  },
})
// #8376
export const CustomPropsNotErased =
  _CustomPropsNotErased as typeof _CustomPropsNotErased & {
    foo: string
  }
