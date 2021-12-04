import {
  ref,
  createElementVNode
} from './index'

describe('createElementVNode with ref', () => {
  const divRef = ref<HTMLElement>()
  
  // #4954
  createElementVNode("div", {
    ref: (_value, _refs) => {
      _refs['divRef'] = _value
      divRef.value = _value
    }
  }, "Hello World", 512 /* NEED_PATCH */)
})