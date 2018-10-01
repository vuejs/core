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
}

export interface TestText {
  id: number
  type: NodeTypes.TEXT
  parentNode: TestElement | null
  text: string
}

export type TestNode = TestElement | TestText

const enum OpTypes {
  CREATE = 'create',
  INSERT = 'insert',
  APPEND = 'append',
  REMOVE = 'remove',
  SET_TEXT = 'setText',
  CLEAR = 'clearContent',
  NEXT_SIBLING = 'nextSibling',
  PARENT_NODE = 'parentNode'
}

interface Op {
  type: OpTypes
  nodeType?: NodeTypes
  tag?: string
  text?: string
  targetNode?: TestNode
  parentNode?: TestElement
  refNode?: TestNode
}

let nodeId: number = 0
let isRecording: boolean = false
let recordedOps: Op[] = []

function logOp(op: Op) {
  if (isRecording) {
    recordedOps.push(op)
  }
}

export function startRecordingOps() {
  if (!isRecording) {
    isRecording = true
    recordedOps = []
  } else {
    throw new Error(
      '`startRecordingOps` called when there is already an active session.'
    )
  }
}

export function dumpOps(): Op[] {
  if (!isRecording) {
    throw new Error(
      '`dumpOps` called without a recording session. ' +
        'Call `startRecordingOps` first to start a session.'
    )
  }
  isRecording = false
  return recordedOps.slice()
}

function createElement(tag: string): TestElement {
  const node: TestElement = {
    id: nodeId++,
    type: NodeTypes.ELEMENT,
    tag,
    children: [],
    props: {},
    parentNode: null
  }
  logOp({
    type: OpTypes.CREATE,
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
  logOp({
    type: OpTypes.CREATE,
    nodeType: NodeTypes.TEXT,
    targetNode: node,
    text
  })
  return node
}

function setText(node: TestText, text: string) {
  logOp({
    type: OpTypes.SET_TEXT,
    targetNode: node,
    text
  })
  node.text = text
}

function appendChild(parent: TestElement, child: TestNode) {
  logOp({
    type: OpTypes.APPEND,
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
  logOp({
    type: OpTypes.INSERT,
    targetNode: child,
    parentNode: parent,
    refNode: ref
  })
  parent.children.splice(refIndex, 0, child)
  child.parentNode = parent
}

function replaceChild(
  parent: TestElement,
  oldChild: TestNode,
  newChild: TestNode
) {
  insertBefore(parent, newChild, oldChild)
  removeChild(parent, oldChild)
}

function removeChild(parent: TestElement, child: TestNode) {
  logOp({
    type: OpTypes.REMOVE,
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
  logOp({
    type: OpTypes.CLEAR,
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
  logOp({
    type: OpTypes.PARENT_NODE,
    targetNode: node
  })
  return node.parentNode
}

function nextSibling(node: TestNode): TestNode | null {
  logOp({
    type: OpTypes.NEXT_SIBLING,
    targetNode: node
  })
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
  replaceChild,
  removeChild,
  clearContent,
  parentNode,
  nextSibling,
  querySelector
}
