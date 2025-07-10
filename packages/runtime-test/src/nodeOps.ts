import { markRaw } from '@vue/reactivity'

export enum TestNodeTypes {
  TEXT = 'text',
  ELEMENT = 'element',
  COMMENT = 'comment',
}

export enum NodeOpTypes {
  CREATE = 'create',
  INSERT = 'insert',
  REMOVE = 'remove',
  SET_TEXT = 'setText',
  SET_ELEMENT_TEXT = 'setElementText',
  PATCH = 'patch',
}

export interface TestElement {
  id: number
  type: TestNodeTypes.ELEMENT
  parentNode: TestElement | null
  tag: string
  children: TestNode[]
  props: Record<string, any>
  eventListeners: Record<string, Function | Function[]> | null
}

export interface TestText {
  id: number
  type: TestNodeTypes.TEXT
  parentNode: TestElement | null
  text: string
}

export interface TestComment {
  id: number
  type: TestNodeTypes.COMMENT
  parentNode: TestElement | null
  text: string
}

export type TestNode = TestElement | TestText | TestComment

export interface NodeOp {
  type: NodeOpTypes
  nodeType?: TestNodeTypes
  tag?: string
  text?: string
  targetNode?: TestNode
  parentNode?: TestElement
  refNode?: TestNode | null
  propKey?: string
  propPrevValue?: any
  propNextValue?: any
}

let nodeId: number = 0
let recordedNodeOps: NodeOp[] = []

export function logNodeOp(op: NodeOp): void {
  recordedNodeOps.push(op)
}

export function resetOps(): void {
  recordedNodeOps = []
}

export function dumpOps(): NodeOp[] {
  const ops = recordedNodeOps.slice()
  resetOps()
  return ops
}

function createElement(tag: string): TestElement {
  const node: TestElement = {
    id: nodeId++,
    type: TestNodeTypes.ELEMENT,
    tag,
    children: [],
    props: {},
    parentNode: null,
    eventListeners: null,
  }
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: TestNodeTypes.ELEMENT,
    targetNode: node,
    tag,
  })
  // avoid test nodes from being observed
  markRaw(node)
  return node
}

function createText(text: string): TestText {
  const node: TestText = {
    id: nodeId++,
    type: TestNodeTypes.TEXT,
    text,
    parentNode: null,
  }
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: TestNodeTypes.TEXT,
    targetNode: node,
    text,
  })
  // avoid test nodes from being observed
  markRaw(node)
  return node
}

function createComment(text: string): TestComment {
  const node: TestComment = {
    id: nodeId++,
    type: TestNodeTypes.COMMENT,
    text,
    parentNode: null,
  }
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: TestNodeTypes.COMMENT,
    targetNode: node,
    text,
  })
  // avoid test nodes from being observed
  markRaw(node)
  return node
}

function setText(node: TestText, text: string): void {
  logNodeOp({
    type: NodeOpTypes.SET_TEXT,
    targetNode: node,
    text,
  })
  node.text = text
}

function insert(
  child: TestNode,
  parent: TestElement,
  ref?: TestNode | null,
): void {
  let refIndex
  if (ref) {
    refIndex = parent.children.indexOf(ref)
    if (refIndex === -1) {
      console.error('ref: ', ref)
      console.error('parent: ', parent)
      throw new Error('ref is not a child of parent')
    }
  }
  logNodeOp({
    type: NodeOpTypes.INSERT,
    targetNode: child,
    parentNode: parent,
    refNode: ref,
  })
  // remove the node first, but don't log it as a REMOVE op
  remove(child, false)
  // re-calculate the ref index because the child's removal may have affected it
  refIndex = ref ? parent.children.indexOf(ref) : -1
  if (refIndex === -1) {
    parent.children.push(child)
    child.parentNode = parent
  } else {
    parent.children.splice(refIndex, 0, child)
    child.parentNode = parent
  }
}

function remove(child: TestNode, logOp = true): void {
  const parent = child.parentNode
  if (parent) {
    if (logOp) {
      logNodeOp({
        type: NodeOpTypes.REMOVE,
        targetNode: child,
        parentNode: parent,
      })
    }
    const i = parent.children.indexOf(child)
    if (i > -1) {
      parent.children.splice(i, 1)
    } else {
      console.error('target: ', child)
      console.error('parent: ', parent)
      throw Error('target is not a childNode of parent')
    }
    child.parentNode = null
  }
}

function setElementText(el: TestElement, text: string): void {
  logNodeOp({
    type: NodeOpTypes.SET_ELEMENT_TEXT,
    targetNode: el,
    text,
  })
  el.children.forEach(c => {
    c.parentNode = null
  })
  if (!text) {
    el.children = []
  } else {
    el.children = [
      {
        id: nodeId++,
        type: TestNodeTypes.TEXT,
        text,
        parentNode: el,
      },
    ]
  }
}

function parentNode(node: TestNode): TestElement | null {
  return node.parentNode
}

function nextSibling(node: TestNode): TestNode | null {
  const parent = node.parentNode
  if (!parent) {
    return null
  }
  const i = parent.children.indexOf(node)
  return parent.children[i + 1] || null
}

function querySelector(): never {
  throw new Error('querySelector not supported in test renderer.')
}

function setScopeId(el: TestElement, id: string): void {
  el.props[id] = ''
}

export const nodeOps: {
  insert: typeof insert
  remove: typeof remove
  createElement: typeof createElement
  createText: typeof createText
  createComment: typeof createComment
  setText: typeof setText
  setElementText: typeof setElementText
  parentNode: typeof parentNode
  nextSibling: typeof nextSibling
  querySelector: typeof querySelector
  setScopeId: typeof setScopeId
} = {
  insert,
  remove,
  createElement,
  createText,
  createComment,
  setText,
  setElementText,
  parentNode,
  nextSibling,
  querySelector,
  setScopeId,
}
