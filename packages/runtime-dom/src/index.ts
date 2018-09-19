import {
  h,
  cloneVNode,
  createPortal,
  Component,
  createRenderer
} from '@vue/core'

import { queueJob, nextTick } from '@vue/scheduler'

import { nodeOps } from './nodeOps'
import { patchData } from './patchData'
import { teardownVNode } from './teardownVNode'

const { render } = createRenderer({
  queueJob,
  nodeOps,
  patchData,
  teardownVNode
})

// important: inline the definition for nextTick
const publicNextTick = nextTick as (fn: Function) => Promise<void>

export { h, cloneVNode, createPortal, Component, render, publicNextTick as nextTick }

// also expose observer API
export {
  autorun,
  stop,
  observable,
  immutable,
  computed,
  isObservable,
  isImmutable,
  markImmutable,
  markNonReactive,
  unwrap
} from '@vue/core'
