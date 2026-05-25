import { bench, describe } from 'vitest'
import { shallowRef } from '@vue/reactivity'
import {
  type Block,
  insert,
  insertFragment,
  insertNode,
  remove,
  removeFragment,
  removeNode,
} from '../../src/block'
import {
  type VaporComponent,
  VaporComponentInstance,
} from '../../src/component'
import { DynamicFragment, ForBlock, VaporFragment } from '../../src/fragment'

const DOM_BATCH = 1000

function createText(): Text {
  return document.createTextNode('')
}

function createForBlock(block: Block): ForBlock {
  return new ForBlock(block, undefined, shallowRef(0), undefined, undefined, 0)
}

function createComponent(node: Node): VaporComponentInstance {
  const instance = new VaporComponentInstance((() => node) as VaporComponent)
  instance.block = node
  instance.isMounted = true
  return instance
}

function createDynamicFragment(node: Node): DynamicFragment {
  const fragment = new DynamicFragment('dynamic-component', false, false)
  fragment.nodes = node
  return fragment
}

function createSlotLikeFragment(node: Node): VaporFragment {
  const fragment = new VaporFragment(node)
  fragment.anchor = createText()
  fragment.insert = (parent, anchor) => {
    insert(node, parent, anchor)
  }
  return fragment
}

describe('block real DOM ops', () => {
  const container = document.createElement('div')
  const singleNodeBlock = createForBlock(createText())
  const componentNode = createText()
  const component = createComponent(componentNode)
  const componentBlock = createForBlock(component)
  const componentArray = [createText(), createComponent(createText())]
  const componentArrayBlock = createForBlock(componentArray)
  const fragment = createDynamicFragment(createText())
  const fragmentBlock = createForBlock(fragment)
  const slotLikeFragment = createSlotLikeFragment(createText())
  const slotLikeFragmentBlock = createForBlock(slotLikeFragment)

  bench('insert/remove(ForBlock single Node)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      insert(singleNodeBlock, container)
      remove(singleNodeBlock, container)
    }
  })

  bench('insertNode/removeNode(ForBlock.nodes)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      insertNode(singleNodeBlock.nodes as Node, container)
      removeNode(singleNodeBlock.nodes as Node, container)
    }
  })

  bench('insert/remove(ForBlock component)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      insert(componentBlock, container)
      remove(componentBlock, container)
    }
  })

  bench('insert/remove(ForBlock.nodes component)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      insert(componentBlock.nodes, container)
      remove(componentBlock.nodes, container)
    }
  })

  bench('insert/remove(ForBlock component array)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      insert(componentArrayBlock, container)
      remove(componentArrayBlock, container)
    }
  })

  bench('insert/remove(ForBlock.nodes component array)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      insert(componentArrayBlock.nodes, container)
      remove(componentArrayBlock.nodes, container)
    }
  })

  bench('insert/remove(ForBlock fragment)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      insert(fragmentBlock, container)
      remove(fragmentBlock, container)
    }
  })

  bench('insertFragment/removeFragment(ForBlock.nodes fragment)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      insertFragment(fragmentBlock.nodes as DynamicFragment, container)
      removeFragment(fragmentBlock.nodes as DynamicFragment, container)
    }
  })

  bench('insert/remove(ForBlock slot-like fragment)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      insert(slotLikeFragmentBlock, container)
      remove(slotLikeFragmentBlock, container)
    }
  })

  bench('insertFragment/removeFragment(ForBlock.nodes slot-like fragment)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      insertFragment(slotLikeFragmentBlock.nodes as VaporFragment, container)
      removeFragment(slotLikeFragmentBlock.nodes as VaporFragment, container)
    }
  })
})

describe('block real DOM remove/reinsert ops', () => {
  const singleNodeContainer = document.createElement('div')
  const singleNodeBlock = createForBlock(createText())
  insertNode(singleNodeBlock.nodes as Node, singleNodeContainer)

  const fragmentContainer = document.createElement('div')
  const fragmentBlock = createForBlock(createDynamicFragment(createText()))
  insertFragment(fragmentBlock.nodes as DynamicFragment, fragmentContainer)

  const slotLikeFragmentContainer = document.createElement('div')
  const slotLikeFragmentBlock = createForBlock(
    createSlotLikeFragment(createText()),
  )
  insertFragment(
    slotLikeFragmentBlock.nodes as VaporFragment,
    slotLikeFragmentContainer,
  )

  bench('remove/reinsert(ForBlock single Node)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      remove(singleNodeBlock, singleNodeContainer)
      insertNode(singleNodeBlock.nodes as Node, singleNodeContainer)
    }
  })

  bench('removeNode/reinsert(ForBlock.nodes)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      removeNode(singleNodeBlock.nodes as Node, singleNodeContainer)
      insertNode(singleNodeBlock.nodes as Node, singleNodeContainer)
    }
  })

  bench('remove/reinsert(ForBlock fragment)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      remove(fragmentBlock, fragmentContainer)
      insertFragment(fragmentBlock.nodes as DynamicFragment, fragmentContainer)
    }
  })

  bench('removeFragment/reinsert(ForBlock.nodes fragment)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      removeFragment(fragmentBlock.nodes as DynamicFragment, fragmentContainer)
      insertFragment(fragmentBlock.nodes as DynamicFragment, fragmentContainer)
    }
  })

  bench('remove/reinsert(ForBlock slot-like fragment)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      remove(slotLikeFragmentBlock, slotLikeFragmentContainer)
      insertFragment(
        slotLikeFragmentBlock.nodes as VaporFragment,
        slotLikeFragmentContainer,
      )
    }
  })

  bench('removeFragment/reinsert(ForBlock.nodes slot-like fragment)', () => {
    for (let i = 0; i < DOM_BATCH; i++) {
      removeFragment(
        slotLikeFragmentBlock.nodes as VaporFragment,
        slotLikeFragmentContainer,
      )
      insertFragment(
        slotLikeFragmentBlock.nodes as VaporFragment,
        slotLikeFragmentContainer,
      )
    }
  })
})
