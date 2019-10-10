import { Directive } from '@vue/runtime-core'

// We are exporting the v-model runtime directly as vnode hooks so that it can
// be tree-shaken in case v-model is never used.
export const vModelText: Directive = {
  beforeMount(el, binding) {
    el.value = binding.value
  },
  mounted(el, binding, vnode) {},
  beforeUpdate(el, binding, vnode, prevVNode) {},
  updated(el, binding, vnode) {}
}

export const vModelRadio: Directive = {
  beforeMount(el, binding, vnode) {},
  mounted(el, binding, vnode) {},
  beforeUpdate(el, binding, vnode, prevVNode) {},
  updated(el, binding, vnode) {}
}

export const vModelCheckbox: Directive = {
  beforeMount(el, binding, vnode) {},
  mounted(el, binding, vnode) {},
  beforeUpdate(el, binding, vnode, prevVNode) {},
  updated(el, binding, vnode) {}
}

export const vModelSelect: Directive = {
  beforeMount(el, binding, vnode) {},
  mounted(el, binding, vnode) {},
  beforeUpdate(el, binding, vnode, prevVNode) {},
  updated(el, binding, vnode) {}
}

export const vModelDynamic: Directive = {
  beforeMount(el, binding, vnode) {},
  mounted(el, binding, vnode) {},
  beforeUpdate(el, binding, vnode, prevVNode) {},
  updated(el, binding, vnode) {}
}
