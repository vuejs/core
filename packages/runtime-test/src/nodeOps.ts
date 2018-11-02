export const enum NodeTypes {
  TEXT = 'text',
  ELEMENT = 'element'
}

export interface TestElement {
  id: number
  type: NodeTypes.ELEMENT
  parentNode: TestElement | null
  tag: string
  children: TestNode[]
  props: Record<string, any>
  eventListeners: Record<string, Function | Function[]> | null
}

export interface TestText {
  id: number
  type: NodeTypes.TEXT
  parentNode: TestElement | null
  text: string
}

export type TestNode = TestElement | TestText

export const enum NodeOpTypes {
  CREATE = 'create',
  INSERT = 'insert',
  APPEND = 'append',
  REMOVE = 'remove',
  SET_TEXT = 'setText',
  CLEAR = 'clearContent',
  PATCH = 'patch'
}

export interface NodeOp {
  type: NodeOpTypes
  nodeType?: NodeTypes
  tag?: string
  text?: string
  targetNode?: TestNode
  parentNode?: TestElement
  refNode?: TestNode
  propKey?: string
  propPrevValue?: any
  propNextValue?: any
}

let nodeId: number = 0
let recordedNodeOps: NodeOp[] = []

export function logNodeOp(op: NodeOp) {
  recordedNodeOps.push(op)
}

export function resetOps() {
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
    type: NodeTypes.ELEMENT,
    tag,
    children: [],
    props: {},
    parentNode: null,
    eventListeners: null
  }
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: NodeTypes.ELEMENT,
    targetNode: node,
    tag
  })
  return node
}

function createText(text: string): TestText {
  const node: TestText = {
    id: nodeId++,
    type: NodeTypes.TEXT,
    text,
    parentNode: null
  }
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: NodeTypes.TEXT,
    targetNode: node,
    text
  })
  return node
}

function setText(node: TestText, text: string) {
  logNodeOp({
    type: NodeOpTypes.SET_TEXT,
    targetNode: node,
    text
  })
  node.text = text
}

function appendChild(parent: TestElement, child: TestNode) {
  logNodeOp({
    type: NodeOpTypes.APPEND,
    targetNode: child,
    parentNode: parent
  })
  if (child.parentNode) {
    removeChild(child.parentNode, child)
  }
  parent.children.push(child)
  child.parentNode = parent
}

function insertBefore(parent: TestElement, child: TestNode, ref: TestNode) {
  if (child.parentNode) {
    removeChild(child.parentNode, child)
  }
  const refIndex = parent.children.indexOf(ref)
  if (refIndex === -1) {
    console.error('ref: ', ref)
    console.error('parent: ', parent)
    throw new Error('ref is not a child of parent')
  }
  logNodeOp({
    type: NodeOpTypes.INSERT,
    targetNode: child,
    parentNode: parent,
    refNode: ref
  })
  parent.children.splice(refIndex, 0, child)
  child.parentNode = parent
}

function removeChild(parent: TestElement, child: TestNode) {
  logNodeOp({
    type: NodeOpTypes.REMOVE,
    targetNode: child,
    parentNode: parent
  })
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

function clearContent(node: TestNode) {
  logNodeOp({
    type: NodeOpTypes.CLEAR,
    targetNode: node
  })
  if (node.type === NodeTypes.ELEMENT) {
    node.children.forEach(c => {
      c.parentNode = null
    })
    node.children = []
  } else {
    node.text = ''
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

function querySelector() {
  throw new Error('querySelector not supported in test renderer.')
}

export const nodeOps = {
  createElement,
  createText,
  setText,
  appendChild,
  insertBefore,
  removeChild,
  clearContent,
  parentNode,
  nextSibling,
  querySelector
}

export function patchData() {}
