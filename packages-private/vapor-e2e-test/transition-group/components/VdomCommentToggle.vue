<script lang="ts">
import { createCommentVNode, defineComponent, h } from 'vue'

export default defineComponent({
  name: 'VdomCommentToggle',
  props: {
    show: Boolean,
  },
  setup(props) {
    return () =>
      props.show
        ? h('div', { class: 'test' }, 'child')
        : createCommentVNode('v-if', true)
  },
})
</script>
