import Vue from '@vue/compat'
import { PatchFlags, SlotFlags } from '@vue/shared'

import { NULL_DYNAMIC_COMPONENT } from '../src/helpers/resolveAssets'
import { toggleDeprecationWarning } from '../src/compat/compatConfig'
import { createVNode } from '../src/vnode'

import { legacyMarkOnce } from '../src/compat/renderHelpers'

beforeEach(() => {
  toggleDeprecationWarning(true)
  Vue.configureCompat({
    MODE: 2,
    GLOBAL_MOUNT: 'suppress-warning',
    GLOBAL_EXTEND: 'suppress-warning',
  })
})

afterEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 3 })
})

test('legacyMarkOnce returns tree', () => {
  const emptyNode = createVNode(NULL_DYNAMIC_COMPONENT)
  expect(legacyMarkOnce(emptyNode)).toBe(emptyNode)

  const pBlock = createVNode('p', null, 'foo', PatchFlags.TEXT)
  expect(legacyMarkOnce(pBlock)).toBe(pBlock)
})
